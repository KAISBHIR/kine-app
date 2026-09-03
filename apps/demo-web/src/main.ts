import {
  countWord,
  exerciseName,
  landmarkIndex,
  say,
  type EngineEvent,
  type Frame,
  type Locale,
} from '@kine/shared';
import {
  ExerciseSession,
  applySuggestion,
  calibrate,
  computeSignal,
  verifyCalibration,
  type CalibrationReport,
  type ExerciseDefinition,
} from '@kine/movement-engine';
import { getExercise, listExercises } from '@kine/exercise-library';
import { LandmarkRecorder } from '@kine/pose-source';
import { WebPoseSource } from '@kine/pose-source/web';
import { drawSkeleton, fitOverlay } from './skeleton';
import { WebSpeechVoice } from './voice';
import { downloadFixture } from './recorder';
import { applyI18n, getLocale, loadStoredLocale, setLocale, t } from './i18n';
import {
  exerciseForArea,
  loadProfile,
  saveProfile,
  type PatientProfile,
  type Prescriber,
  type RehabArea,
} from './profile';
import { SkeletonReplay } from './replay';
import {
  SessionVideoRecorder,
  shareOrDownloadVideo,
  videoFileExtension,
} from './videoRecorder';

/** Continuous time the whole body must be visible before the session starts. */
const SETUP_STABLE_MS = 1200;
/** Minimum gap between two "extend a little further" prompts. */
const PARTIAL_CUE_COOLDOWN_MS = 7000;

function must<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as unknown as T;
}

const els = {
  screenLanguage: must<HTMLElement>('screen-language'),
  screenProfile: must<HTMLElement>('screen-profile'),
  screenHome: must<HTMLElement>('screen-home'),
  screenStart: must<HTMLElement>('screen-start'),
  screenSession: must<HTMLElement>('screen-session'),
  screenDone: must<HTMLElement>('screen-done'),
  screenCalibrated: must<HTMLElement>('screen-calibrated'),

  profileName: must<HTMLInputElement>('profile-name'),
  profileAge: must<HTMLInputElement>('profile-age'),
  profileArea: must<HTMLSelectElement>('profile-area'),
  profilePrescriber: must<HTMLSelectElement>('profile-prescriber'),
  btnProfileContinue: must<HTMLButtonElement>('btn-profile-continue'),

  homeGreeting: must<HTMLElement>('home-greeting'),
  homeExerciseName: must<HTMLElement>('home-exercise-name'),
  homeSessionInfo: must<HTMLElement>('home-session-info'),
  videoConsent: must<HTMLInputElement>('video-consent'),
  btnHomeStart: must<HTMLButtonElement>('btn-home-start'),
  btnHomeAdvanced: must<HTMLButtonElement>('btn-home-advanced'),
  btnHomeEditProfile: must<HTMLButtonElement>('btn-home-edit-profile'),
  btnStartBack: must<HTMLButtonElement>('btn-start-back'),

  exerciseSelect: must<HTMLSelectElement>('exercise-select'),
  targetSelect: must<HTMLSelectElement>('target-select'),
  btnStart: must<HTMLButtonElement>('btn-start'),
  btnCalibrate: must<HTMLButtonElement>('btn-calibrate'),
  btnStop: must<HTMLButtonElement>('btn-stop'),
  btnAgain: must<HTMLButtonElement>('btn-again'),
  btnRecord: must<HTMLButtonElement>('btn-record'),
  btnRecordLabel: must<HTMLElement>('btn-record-label'),
  btnDebug: must<HTMLButtonElement>('btn-debug'),
  startError: must<HTMLElement>('start-error'),

  video: must<HTMLVideoElement>('video'),
  overlay: must<HTMLCanvasElement>('overlay'),
  repDone: must<HTMLElement>('rep-done'),
  repOf: must<HTMLElement>('rep-of'),
  repTarget: must<HTMLElement>('rep-target'),
  counterUnit: must<HTMLElement>('counter-unit'),
  status: must<HTMLElement>('status'),
  statusText: must<HTMLElement>('status-text'),
  cue: must<HTMLElement>('cue'),
  debug: must<HTMLElement>('debug'),

  sumReps: must<HTMLElement>('sum-reps'),
  sumQuality: must<HTMLElement>('sum-quality'),
  sumDuration: must<HTMLElement>('sum-duration'),
  sumRom: must<HTMLElement>('sum-rom'),
  sumCues: must<HTMLElement>('sum-cues'),

  replayCard: must<HTMLElement>('replay-card'),
  btnReplayToggle: must<HTMLButtonElement>('btn-replay-toggle'),
  btnReplayLabel: must<HTMLElement>('btn-replay-label'),
  replayCanvas: must<HTMLCanvasElement>('replay-canvas'),

  videoCard: must<HTMLElement>('video-card'),
  videoPlayback: must<HTMLVideoElement>('video-playback'),
  btnVideoShare: must<HTMLButtonElement>('btn-video-share'),
  btnVideoDownload: must<HTMLButtonElement>('btn-video-download'),

  calRest: must<HTMLElement>('cal-rest'),
  calPeak: must<HTMLElement>('cal-peak'),
  calCycles: must<HTMLElement>('cal-cycles'),
  calVerdict: must<HTMLElement>('cal-verdict'),
  calWarnings: must<HTMLElement>('cal-warnings'),
  calJson: must<HTMLElement>('cal-json'),
  calError: must<HTMLElement>('cal-error'),
  btnCalCopy: must<HTMLButtonElement>('btn-cal-copy'),
  btnCalDownload: must<HTMLButtonElement>('btn-cal-download'),
  btnCalAgain: must<HTMLButtonElement>('btn-cal-again'),
};

const ctx = els.overlay.getContext('2d')!;
const recorder = new LandmarkRecorder();
const videoRecorder = new SessionVideoRecorder();

let voice = new WebSpeechVoice(getLocale());

type Stage =
  | 'language'
  | 'profile'
  | 'home'
  | 'idle'
  | 'setup'
  | 'active'
  | 'done'
  | 'calibrated';
type Mode = 'session' | 'calibrate';

let stage: Stage = 'language';
let mode: Mode = 'session';
let source: WebPoseSource | null = null;
let session: ExerciseSession | null = null;
let def: ExerciseDefinition = getExercise('seated_knee_extension');
let targetReps = 10;

let setupGoodSince: number | null = null;
let lastPartialCueAt = -Infinity;
let cueHideTimer = 0;
let trackingOk = true;

/** Raw frames kept during a calibration run. Landmarks only — never video. */
let calFrames: Frame[] = [];
let calibratedJson = '';

/**
 * Landmarks captured during an actual session, from the moment coaching
 * begins. This is what feeds the skeleton replay on the summary screen — the
 * default, privacy-preserving way a clinician can review what happened.
 */
let sessionFrames: Frame[] = [];
let replay: SkeletonReplay | null = null;

/** Set at the start of a session from the consent checkbox on Home. */
let wantsVideo = false;
let lastVideoBlob: Blob | null = null;

// FPS is measured rather than assumed: it is the first number to look at when
// rep detection misbehaves on a particular phone.
let fpsWindow: number[] = [];
let lastFrameT = 0;
let debugVisible = false;

// --- boot ----------------------------------------------------------------

function populateExerciseOptions(): void {
  els.exerciseSelect.innerHTML = '';
  for (const d of listExercises()) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = exerciseName(d.nameKey, getLocale());
    els.exerciseSelect.append(opt);
  }
  els.exerciseSelect.value = def.id;
}

function boot(): void {
  const stored = loadStoredLocale();
  if (!stored) {
    showScreen('language');
    return;
  }

  setLocale(stored);
  applyI18n();
  populateExerciseOptions();
  voice = new WebSpeechVoice(getLocale());

  const profile = loadProfile();
  if (profile) {
    goHome(profile);
  } else {
    showScreen('profile');
  }
}

function goHome(profile?: PatientProfile): void {
  const p = profile ?? loadProfile();
  if (p) renderHome(p);
  showScreen('home');
}

function renderHome(profile: PatientProfile): void {
  els.homeGreeting.textContent = t('home.greeting', { name: profile.name });

  const exerciseId = exerciseForArea(profile.area);
  const exerciseDef = getExercise(exerciseId);
  els.exerciseSelect.value = exerciseId;

  els.homeExerciseName.textContent = exerciseName(exerciseDef.nameKey, getLocale());
  const minutes = Math.max(1, Math.round((targetReps * 5) / 60));
  els.homeSessionInfo.textContent = t('home.sessionInfo', { count: 1, minutes });
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('.lang-btn')) {
  btn.addEventListener('click', () => {
    const locale = btn.dataset.lang as Locale;
    setLocale(locale);
    applyI18n();
    populateExerciseOptions();
    voice = new WebSpeechVoice(getLocale());

    const profile = loadProfile();
    if (profile) {
      goHome(profile);
    } else {
      showScreen('profile');
    }
  });
}

els.btnProfileContinue.addEventListener('click', () => {
  const name = els.profileName.value.trim();
  if (!name) {
    els.profileName.focus();
    return;
  }

  const profile: PatientProfile = {
    name,
    age: els.profileAge.value ? Number(els.profileAge.value) : null,
    area: els.profileArea.value as RehabArea,
    prescriber: els.profilePrescriber.value as Prescriber,
  };
  saveProfile(profile);
  goHome(profile);
});

els.btnHomeStart.addEventListener('click', () => void begin('session'));
els.btnHomeAdvanced.addEventListener('click', () => showScreen('idle'));
els.btnHomeEditProfile.addEventListener('click', () => {
  const p = loadProfile();
  if (p) {
    els.profileName.value = p.name;
    els.profileAge.value = p.age ? String(p.age) : '';
    els.profileArea.value = p.area;
    els.profilePrescriber.value = p.prescriber;
  }
  showScreen('profile');
});
els.btnStartBack.addEventListener('click', () => goHome());

els.btnStart.addEventListener('click', () => void begin('session'));
els.btnCalibrate.addEventListener('click', () => void begin('calibrate'));
els.btnStop.addEventListener('click', () => finish());
els.btnAgain.addEventListener('click', () => goHome());
els.btnCalAgain.addEventListener('click', () => showScreen('idle'));
els.btnDebug.addEventListener('click', () => {
  debugVisible = !debugVisible;
  els.debug.hidden = !debugVisible;
});
els.btnRecord.addEventListener('click', () => toggleRecording());
els.btnCalCopy.addEventListener('click', () => void copyCalibration());
els.btnCalDownload.addEventListener('click', () => downloadCalibration());
els.btnReplayToggle.addEventListener('click', () => toggleReplay());
els.btnVideoShare.addEventListener('click', () => void shareVideo());
els.btnVideoDownload.addEventListener('click', () => downloadVideo());
window.addEventListener('resize', () => fitOverlay(els.video, els.overlay));

boot();

// --- lifecycle -----------------------------------------------------------

async function begin(nextMode: Mode): Promise<void> {
  els.startError.hidden = true;
  mode = nextMode;
  def = getExercise(els.exerciseSelect.value);
  targetReps = Number(els.targetSelect.value);

  session = nextMode === 'session' ? new ExerciseSession(def) : null;
  calFrames = [];
  sessionFrames = [];
  wantsVideo = nextMode === 'session' && els.videoConsent.checked;
  lastVideoBlob = null;
  setupGoodSince = null;
  lastPartialCueAt = -Infinity;
  trackingOk = true;
  fpsWindow = [];

  els.repDone.textContent = nextMode === 'session' ? '0' : '—';
  els.repTarget.textContent = String(targetReps);
  els.repOf.hidden = nextMode === 'calibrate';
  els.counterUnit.hidden = nextMode === 'session';
  setStatus('Préparation…', '');
  hideCue();

  showScreen('setup');

  source = new WebPoseSource({ video: els.video, facingMode: 'user' });
  source.onFrame(onFrame);
  source.onError((e) => setStatus(`Erreur caméra : ${e.message}`, 'lost'));

  try {
    await source.start();
    fitOverlay(els.video, els.overlay);
    speak('cue.setup_distance');

    if (wantsVideo) {
      const stream = source.mediaStream;
      wantsVideo = stream !== null && videoRecorder.start(stream);
    }
  } catch (e) {
    source = null;
    showScreen('idle');
    els.startError.hidden = false;
    els.startError.textContent = cameraErrorMessage(e);
  }
}

function onFrame(frame: Frame): void {
  measureFps(frame.t);
  recorder.push(frame);

  fitOverlay(els.video, els.overlay);
  drawSkeleton(ctx, frame.landmarks, {
    highlight: trackedLimbIndices(),
    degraded: !trackingOk,
  });

  if (stage === 'setup') {
    handleSetup(frame);
  } else if (stage === 'active') {
    if (mode === 'calibrate') {
      calFrames.push(frame);
      const angle = computeSignal(frame, def.signal, session?.side ?? 'left');
      els.repDone.textContent = angle === null ? '—' : String(Math.round(angle));
    } else if (session) {
      sessionFrames.push(frame);
      for (const ev of session.push(frame)) handleEvent(ev);
    }
  }

  if (debugVisible) renderDebug(frame);
}

function handleSetup(frame: Frame): void {
  if (!bodyVisible(frame)) {
    setupGoodSince = null;
    setStatus('Reculez, je dois voir tout votre corps', 'lost');
    return;
  }

  setupGoodSince ??= frame.t;
  if (frame.t - setupGoodSince < SETUP_STABLE_MS) {
    setStatus('Ne bougez pas…', '');
    return;
  }

  stage = 'active';

  if (mode === 'calibrate') {
    setStatus('Faites 5 à 8 répétitions à votre rythme', 'ok');
    speak('cue.setup_ready');
    return;
  }

  setStatus('Prêt', 'ok');
  speak('cue.setup_ready');
  setTimeout(() => speak('cue.start'), 1400);
}

function handleEvent(ev: EngineEvent): void {
  switch (ev.kind) {
    case 'rep': {
      els.repDone.textContent = String(ev.index);
      if (ev.index <= 15) voice.say(countWord(ev.index, getLocale()), 'count');
      if (ev.index >= targetReps) finish();
      break;
    }

    case 'partialRep': {
      const now = performance.now();
      if (now - lastPartialCueAt < PARTIAL_CUE_COOLDOWN_MS) break;
      lastPartialCueAt = now;
      showCue('cue.extend_further');
      break;
    }

    case 'formCue':
      showCue(ev.cueKey);
      break;

    case 'visibility':
      trackingOk = ev.ok;
      if (ev.ok) {
        setStatus('Prêt', 'ok');
        speak('cue.tracking_restored');
      } else {
        const legLost = ev.missing.some((p) => p === 'knee' || p === 'ankle');
        setStatus('Je ne vous vois plus', 'lost');
        speak(legLost ? 'cue.cannot_see_leg' : 'cue.cannot_see_body');
      }
      break;

    case 'phase':
      break;
  }
}

function finish(): void {
  if (stage === 'done' || stage === 'calibrated') return;

  const captured = calFrames;
  const replayFrames = sessionFrames;
  const summary = session?.summary() ?? null;

  // MediaRecorder.stop() must run BEFORE the camera tracks are stopped below,
  // or the last buffered chunk of video can be lost.
  const videoPromise = wantsVideo ? videoRecorder.stop() : Promise.resolve(null);

  source?.stop();
  source = null;
  voice.stop();
  if (recorder.isRecording) toggleRecording();

  if (mode === 'calibrate') {
    showCalibration(captured);
    return;
  }

  if (summary) {
    els.sumReps.textContent = String(summary.reps);
    els.sumQuality.textContent = summary.quality === null ? '—' : `${summary.quality}%`;
    els.sumDuration.textContent = formatDuration(summary.durationMs);
    els.sumRom.textContent =
      summary.bestPeakDeg === null ? '—' : `${Math.round(summary.bestPeakDeg)}°`;

    const cueEntries = Object.entries(summary.cues);
    els.sumCues.innerHTML = cueEntries.length
      ? '<b>Rappels donnés</b><br />' +
        cueEntries.map(([id, n]) => `${escapeHtml(id)} × ${n}`).join('<br />')
      : '';
  }

  showScreen('done');
  speak('cue.session_complete');
  setupReplay(replayFrames);

  if (wantsVideo) {
    videoPromise.then((blob) => {
      if (blob) showVideoCard(blob);
    });
  }
}

// --- skeleton replay -------------------------------------------------------

function setupReplay(frames: Frame[]): void {
  replay?.destroy();
  replay = null;

  if (frames.length < 2) {
    els.replayCard.hidden = true;
    return;
  }

  els.replayCard.hidden = false;
  const replayCtx = els.replayCanvas.getContext('2d')!;
  replay = new SkeletonReplay(replayCtx, frames);
  replay.play();
  els.btnReplayLabel.textContent = t('replay.pause');
}

function toggleReplay(): void {
  if (!replay) return;
  if (replay.playing) {
    replay.pause();
    els.btnReplayLabel.textContent = t('replay.play');
  } else {
    replay.play();
    els.btnReplayLabel.textContent = t('replay.pause');
  }
}

// --- consented video ---------------------------------------------------

function showVideoCard(blob: Blob): void {
  lastVideoBlob = blob;
  const url = URL.createObjectURL(blob);
  els.videoPlayback.src = url;
  els.videoCard.hidden = false;
}

function videoFilename(): string {
  const ext = lastVideoBlob ? videoFileExtension(lastVideoBlob.type) : 'webm';
  return `seance-${def.id}.${ext}`;
}

async function shareVideo(): Promise<void> {
  if (!lastVideoBlob) return;
  await shareOrDownloadVideo(lastVideoBlob, videoFilename());
}

function downloadVideo(): void {
  if (!lastVideoBlob) return;
  const url = URL.createObjectURL(lastVideoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = videoFilename();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- calibration ---------------------------------------------------------

/**
 * Turns a recording of the patient moving into thresholds that fit them.
 *
 * The verdict line is the important part of this screen. Suggested numbers are
 * only worth pasting into a definition if the engine, run against the same
 * recording with those numbers, counts the movements that are actually in it.
 */
function showCalibration(frames: Frame[]): void {
  showScreen('calibrated');
  els.calError.hidden = true;
  calibratedJson = '';

  let report: CalibrationReport;
  try {
    report = calibrate({
      frames,
      signal: def.signal,
      requiredParts: def.requiredParts,
      side: def.side,
    });
  } catch (e) {
    els.calRest.textContent = '—';
    els.calPeak.textContent = '—';
    els.calCycles.textContent = '—';
    els.calVerdict.className = 'verdict bad';
    els.calVerdict.textContent = 'Calibration impossible.';
    els.calWarnings.textContent = '';
    els.calJson.textContent = '';
    els.calError.hidden = false;
    els.calError.textContent = e instanceof Error ? e.message : String(e);
    return;
  }

  const complete = report.cycles.filter((c) => c.complete).length;
  els.calRest.textContent = `${Math.round(report.restDeg)}°`;
  els.calPeak.textContent = `${Math.round(report.peakDeg)}°`;
  els.calCycles.textContent = String(complete);

  const tuned = applySuggestion(def, report.suggested);
  const check = verifyCalibration(frames, tuned, report);

  if (check.agrees) {
    els.calVerdict.className = 'verdict ok';
    els.calVerdict.textContent =
      `Vérifié : avec ces valeurs, le moteur compte ${check.reps} répétitions, ` +
      `soit exactement ce que contient l’enregistrement.`;
  } else {
    els.calVerdict.className = 'verdict bad';
    els.calVerdict.textContent =
      `À revoir : le moteur compte ${check.reps} répétitions alors que ` +
      `l’enregistrement en contient ${check.expectedReps}. Recommencez ` +
      `l’enregistrement avant d’utiliser ces valeurs.`;
  }

  els.calWarnings.innerHTML = report.warnings.length
    ? '<b>Remarques</b><br />' + report.warnings.map(escapeHtml).join('<br />')
    : '';

  calibratedJson = JSON.stringify(tuned, null, 2);
  els.calJson.textContent = calibratedJson;
}

async function copyCalibration(): Promise<void> {
  if (!calibratedJson) return;
  try {
    await navigator.clipboard.writeText(calibratedJson);
    els.btnCalCopy.textContent = 'Copié';
    setTimeout(() => (els.btnCalCopy.textContent = 'Copier'), 1500);
  } catch {
    els.calError.hidden = false;
    els.calError.textContent =
      'Copie refusée par le navigateur. Utilisez « Télécharger ».';
  }
}

function downloadCalibration(): void {
  if (!calibratedJson) return;
  const blob = new Blob([calibratedJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${def.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- helpers -------------------------------------------------------------

function showScreen(next: Stage): void {
  stage = next;
  els.screenLanguage.hidden = next !== 'language';
  els.screenProfile.hidden = next !== 'profile';
  els.screenHome.hidden = next !== 'home';
  els.screenStart.hidden = next !== 'idle';
  els.screenSession.hidden = next !== 'setup' && next !== 'active';
  els.screenDone.hidden = next !== 'done';
  els.screenCalibrated.hidden = next !== 'calibrated';

  if (next !== 'done') {
    replay?.destroy();
    replay = null;
    els.replayCard.hidden = true;

    if (els.videoPlayback.src) {
      URL.revokeObjectURL(els.videoPlayback.src);
      els.videoPlayback.removeAttribute('src');
    }
    els.videoCard.hidden = true;
    lastVideoBlob = null;
  }

  if (next === 'language' || next === 'profile' || next === 'home' || next === 'idle') {
    source?.stop();
    source = null;
    session = null;
    calFrames = [];
    sessionFrames = [];
    videoRecorder.discard();
  }
}

/** All required parts visible on at least one side. */
function bodyVisible(frame: Frame): boolean {
  const ok = (side: 'left' | 'right') =>
    def.requiredParts.every(
      (p) => (frame.landmarks[landmarkIndex(p, side)]?.visibility ?? 0) > 0.6,
    );
  return ok('left') || ok('right');
}

function trackedLimbIndices(): number[] {
  const side = session?.side ?? 'left';
  return def.requiredParts.map((p) => landmarkIndex(p, side));
}

function setStatus(text: string, cls: string): void {
  els.statusText.textContent = text;
  els.status.className = `status ${cls}`;
}

function speak(cueKey: string): void {
  voice.say(say(cueKey, getLocale()), 'cue');
}

function showCue(cueKey: string): void {
  const text = say(cueKey, getLocale());
  els.cue.textContent = text;
  els.cue.hidden = false;
  voice.say(text, 'cue');

  clearTimeout(cueHideTimer);
  cueHideTimer = window.setTimeout(hideCue, 4000);
}

function hideCue(): void {
  els.cue.hidden = true;
}

function toggleRecording(): void {
  if (recorder.isRecording) {
    const note = prompt('Note pour cet enregistrement ?') ?? '';
    downloadFixture(recorder.stop(note, navigator.userAgent));
    els.btnRecord.classList.remove('chip--recording');
    els.btnRecordLabel.textContent = 'Enregistrer';
  } else {
    recorder.start(def.id);
    els.btnRecord.classList.add('chip--recording');
    els.btnRecordLabel.textContent = 'Arrêter';
  }
}

function measureFps(t: number): void {
  if (lastFrameT) {
    const dt = t - lastFrameT;
    if (dt > 0) fpsWindow.push(1000 / dt);
    if (fpsWindow.length > 30) fpsWindow.shift();
  }
  lastFrameT = t;
}

function renderDebug(frame: Frame): void {
  const side = session?.side ?? 'left';
  const angle = computeSignal(frame, def.signal, side);
  const fps = fpsWindow.length
    ? fpsWindow.reduce((a, b) => a + b, 0) / fpsWindow.length
    : 0;

  els.debug.textContent = [
    `mode       ${mode}`,
    `exercice   ${def.id}`,
    `étape      ${stage}`,
    `côté       ${side}`,
    `angle brut ${angle === null ? '—' : angle.toFixed(1) + '°'}`,
    `seuils     ${def.rep.exitDeg}° / ${def.rep.enterDeg}°`,
    `reps       ${session?.repCount ?? 0} / ${targetReps}`,
    `suivi      ${trackingOk ? 'ok' : 'perdu'}`,
    `visibility ${source?.modelReportsVisibility ? 'modèle' : 'heuristique'}`,
    `fps        ${fps.toFixed(1)}`,
    `vidéo      ${wantsVideo ? 'oui' : 'non'}`,
    `calib      ${mode === 'calibrate' ? calFrames.length + ' frames' : '—'}`,
  ].join('\n');
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') {
    return 'Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.';
  }
  if (name === 'NotFoundError') return 'Aucune caméra détectée sur cet appareil.';
  if (!window.isSecureContext) {
    return 'La caméra exige HTTPS. Ouvrez la page en https ou sur localhost.';
  }
  return e instanceof Error ? e.message : String(e);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
