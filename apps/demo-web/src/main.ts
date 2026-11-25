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
import { LandmarkRecorder, MockPoseSource } from '@kine/pose-source';
import { cleanReps } from '@kine/movement-engine';
import { WebPoseSource } from '@kine/pose-source/web';
import { drawSkeleton, fitOverlay } from './skeleton';
import { WebSpeechVoice } from './voice';
import { downloadFixture } from './recorder';
import { applyI18n, getLocale, loadStoredLocale, setLocale, t } from './i18n';
import {
  DEFAULT_TARGET_REPS,
  loadProfile,
  programForArea,
  saveProfile,
  type PatientProfile,
  type ProgramItem,
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
  btnProfileBack: must<HTMLButtonElement>('btn-profile-back'),

  homeGreeting: must<HTMLElement>('home-greeting'),
  homeProgram: must<HTMLOListElement>('home-program'),
  homeSessionInfo: must<HTMLElement>('home-session-info'),
  btnHomeLanguage: must<HTMLButtonElement>('btn-home-language'),
  hudExercise: must<HTMLElement>('hud-exercise'),
  btnSkip: must<HTMLButtonElement>('btn-skip'),
  between: must<HTMLElement>('between'),
  betweenStep: must<HTMLElement>('between-step'),
  betweenName: must<HTMLElement>('between-name'),
  betweenReps: must<HTMLElement>('between-reps'),
  betweenSetup: must<HTMLElement>('between-setup'),
  betweenCountdown: must<HTMLElement>('between-countdown'),
  btnBetweenGo: must<HTMLButtonElement>('btn-between-go'),
  sumExercises: must<HTMLUListElement>('sum-exercises'),
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

  homeError: must<HTMLElement>('home-error'),
  doneTitle: must<HTMLElement>('done-title'),
  sumReps: must<HTMLElement>('sum-reps'),
  sumQuality: must<HTMLElement>('sum-quality'),
  sumDuration: must<HTMLElement>('sum-duration'),
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
  | 'between'
  | 'done'
  | 'calibrated';
type Mode = 'session' | 'calibrate';

let stage: Stage = 'language';
let mode: Mode = 'session';
let source: WebPoseSource | MockPoseSource | null = null;

/**
 * `?mock` replaces the camera with the engine's synthetic patient (repeated
 * knee extensions, sped up). Test-only: it lets the whole programme flow —
 * reps, rest card, next exercise, summary — run end to end with nobody in
 * front of the camera.
 */
const MOCK_POSE = new URLSearchParams(location.search).has('mock');

function createSource(): WebPoseSource | MockPoseSource {
  if (!MOCK_POSE) return new WebPoseSource({ video: els.video, facingMode: 'user' });
  const { frames } = cleanReps(60, 165, 4000, { noise: 0.004, seed: 7 });
  return new MockPoseSource({ frames, speed: 6, loop: true });
}
let session: ExerciseSession | null = null;
let def: ExerciseDefinition = getExercise('seated_knee_extension');
let targetReps = DEFAULT_TARGET_REPS;

/**
 * The exercises in this run, in order. A run from Home is the patient's whole
 * programme; a run from Advanced options is a programme of one.
 */
let program: ProgramItem[] = [];
let programIndex = 0;

type Summary = ReturnType<ExerciseSession['summary']>;
interface ExerciseResult {
  def: ExerciseDefinition;
  targetReps: number;
  /** Null when the patient skipped the exercise before it started. */
  summary: Summary | null;
}
let results: ExerciseResult[] = [];

/** Seconds of rest between two exercises before the next one starts by itself. */
const REST_SECONDS = 20;
let restTimer = 0;
let restRemaining = 0;

/**
 * Replay frames are re-timed so the rest between exercises does not show up
 * as a long frozen skeleton in the playback.
 */
let replayShift = 0;
let lastReplayT: number | null = null;
let rebaseReplay = false;

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
  // French is the primary language: a first visit opens straight onto the
  // French profile form. Arabic and English stay one tap away (the back link
  // on the profile form, or "Langue" on Home).
  setLocale(loadStoredLocale() ?? 'fr');
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

  const items = programForArea(profile.area);
  els.exerciseSelect.value = items[0]!.exerciseId;

  els.homeProgram.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'program-list__item';
    const name = document.createElement('span');
    name.className = 'program-list__name';
    name.textContent = exerciseName(getExercise(item.exerciseId).nameKey, getLocale());
    const reps = document.createElement('span');
    reps.className = 'program-list__meta';
    reps.textContent = t('home.repsEach', { reps: item.targetReps });
    li.append(name, reps);
    els.homeProgram.append(li);
  }

  // ~5 s per rep plus the rest between exercises.
  const seconds =
    items.reduce((sum, i) => sum + i.targetReps * 5, 0) + (items.length - 1) * REST_SECONDS;
  const minutes = Math.max(1, Math.round(seconds / 60));
  els.homeSessionInfo.textContent = t('home.sessionInfo', { count: items.length, minutes });
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

// The fixture recorder downloads raw landmark JSON — a developer tool, not
// something a patient or a demo tester should ever tap by accident.
els.btnRecord.hidden = !new URLSearchParams(location.search).has('dev');

let beganFrom: Stage = 'home';

els.btnHomeStart.addEventListener('click', () => {
  beganFrom = 'home';
  void begin('session');
});
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
els.btnHomeLanguage.addEventListener('click', () => showScreen('language'));
els.btnSkip.addEventListener('click', () => completeExercise());
els.btnBetweenGo.addEventListener('click', () => startNextExercise());
els.btnProfileBack.addEventListener('click', () => {
  const p = loadProfile();
  if (p) goHome(p);
  else showScreen('language');
});

els.btnStart.addEventListener('click', () => {
  beganFrom = 'idle';
  void begin('session');
});
els.btnCalibrate.addEventListener('click', () => {
  beganFrom = 'idle';
  void begin('calibrate');
});
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
  els.homeError.hidden = true;
  mode = nextMode;

  // Home runs the patient's whole programme; Advanced runs the one exercise
  // picked there (also the only thing calibration ever works on).
  const profile = loadProfile();
  program =
    beganFrom === 'home' && nextMode === 'session' && profile
      ? programForArea(profile.area)
      : [{ exerciseId: els.exerciseSelect.value, targetReps: Number(els.targetSelect.value) }];
  results = [];

  calFrames = [];
  sessionFrames = [];
  replayShift = 0;
  lastReplayT = null;
  wantsVideo = nextMode === 'session' && els.videoConsent.checked;
  lastVideoBlob = null;
  fpsWindow = [];

  loadExercise(0);
  setStatus(t('status.preparing'), '');

  showScreen('setup');

  source = createSource();
  source.onFrame(onFrame);
  source.onError((e) =>
    setStatus(t('status.cameraError', { message: e.message }), 'lost'),
  );

  try {
    await source.start();
    fitOverlay(els.video, els.overlay);
    speak(def.camera.setupCueKey);
    // The pose source only emits a frame once it finds a body. Without this,
    // someone standing too close or off to the side sees "Getting ready…"
    // forever and has no idea the camera is already waiting for them.
    if (stage === 'setup' && setupGoodSince === null) setStatus(t('status.stepBack'), 'lost');

    if (wantsVideo) {
      const stream = source instanceof WebPoseSource ? source.mediaStream : null;
      wantsVideo = stream !== null && videoRecorder.start(stream);
    }
  } catch (e) {
    source = null;
    const errorEl = beganFrom === 'home' ? els.homeError : els.startError;
    if (beganFrom === 'home') goHome();
    else showScreen('idle');
    errorEl.hidden = false;
    errorEl.textContent = cameraErrorMessage(e);
  }
}

/** Points the engine and the HUD at exercise `index` of the programme. */
function loadExercise(index: number): void {
  programIndex = index;
  const item = program[index]!;
  def = getExercise(item.exerciseId);
  targetReps = item.targetReps;

  session = mode === 'session' ? new ExerciseSession(def) : null;
  setupGoodSince = null;
  lastPartialCueAt = -Infinity;
  trackingOk = true;
  rebaseReplay = true;

  els.repDone.textContent = mode === 'session' ? '0' : '—';
  els.repTarget.textContent = String(targetReps);
  els.repOf.hidden = mode === 'calibrate';
  els.counterUnit.hidden = mode === 'session';

  const name = exerciseName(def.nameKey, getLocale());
  els.hudExercise.hidden = mode !== 'session';
  els.hudExercise.textContent =
    program.length > 1
      ? `${t('session.exerciseOf', { n: index + 1, total: program.length })} · ${name}`
      : name;
  els.btnSkip.hidden = !(mode === 'session' && index < program.length - 1);
  hideCue();
}

/**
 * Closes the current exercise — target reached, or the patient tapped "Next" —
 * and either moves to the rest card or ends the whole run.
 */
function completeExercise(): void {
  if (stage !== 'setup' && stage !== 'active') return;
  recordCurrentResult();

  if (programIndex >= program.length - 1) {
    finish();
    return;
  }
  showBetween();
}

function recordCurrentResult(): void {
  if (mode !== 'session' || results.length > programIndex) return;
  const started = session !== null && (stage === 'active' || session.repCount > 0);
  results.push({ def, targetReps, summary: started && session ? session.summary() : null });
}

function showBetween(): void {
  stage = 'between';
  hideCue();
  voice.stop();
  speak('cue.set_complete');

  const next = program[programIndex + 1]!;
  const nextDef = getExercise(next.exerciseId);
  els.betweenStep.textContent = t('session.exerciseOf', {
    n: programIndex + 2,
    total: program.length,
  });
  els.betweenName.textContent = exerciseName(nextDef.nameKey, getLocale());
  els.betweenReps.textContent = t('home.repsEach', { reps: next.targetReps });
  els.betweenSetup.textContent = say(nextDef.camera.setupCueKey, getLocale());
  els.between.hidden = false;
  els.btnSkip.hidden = true;
  setStatus(t('status.preparing'), '');

  restRemaining = REST_SECONDS;
  renderCountdown();
  clearInterval(restTimer);
  restTimer = window.setInterval(() => {
    restRemaining -= 1;
    if (restRemaining <= 0) startNextExercise();
    else renderCountdown();
  }, 1000);
}

function renderCountdown(): void {
  els.betweenCountdown.textContent = t('between.countdown', { s: restRemaining });
}

function startNextExercise(): void {
  if (stage !== 'between') return;
  clearInterval(restTimer);
  els.between.hidden = true;
  loadExercise(programIndex + 1);
  stage = 'setup';
  setStatus(t('status.stepBack'), 'lost');
  speak('cue.next_exercise');
  const setupCue = def.camera.setupCueKey;
  setTimeout(() => speak(setupCue), 1200);
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
      pushReplayFrame(frame);
      for (const ev of session.push(frame)) handleEvent(ev);
    }
  }

  if (debugVisible) renderDebug(frame);
}

function pushReplayFrame(frame: Frame): void {
  if (rebaseReplay) {
    rebaseReplay = false;
    if (lastReplayT !== null) replayShift = frame.t - lastReplayT - 33;
  }
  const shifted = frame.t - replayShift;
  sessionFrames.push({ ...frame, t: shifted });
  lastReplayT = shifted;
}

function handleSetup(frame: Frame): void {
  if (!bodyVisible(frame)) {
    setupGoodSince = null;
    setStatus(t('status.stepBack'), 'lost');
    return;
  }

  setupGoodSince ??= frame.t;
  if (frame.t - setupGoodSince < SETUP_STABLE_MS) {
    setStatus(t('status.holdStill'), '');
    return;
  }

  stage = 'active';

  if (mode === 'calibrate') {
    setStatus(t('status.calibrateReady'), 'ok');
    speak('cue.setup_ready');
    return;
  }

  setStatus(t('status.ready'), 'ok');
  speak('cue.setup_ready');
  setTimeout(() => speak('cue.start'), 1400);
}

function handleEvent(ev: EngineEvent): void {
  switch (ev.kind) {
    case 'rep': {
      els.repDone.textContent = String(ev.index);
      if (ev.index <= 15) voice.say(countWord(ev.index, getLocale()), 'count');
      if (ev.index >= targetReps) completeExercise();
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
        setStatus(t('status.ready'), 'ok');
        speak('cue.tracking_restored');
      } else {
        const legLost = ev.missing.some((p) => p === 'knee' || p === 'ankle');
        setStatus(t('status.lost'), 'lost');
        speak(legLost ? 'cue.cannot_see_leg' : 'cue.cannot_see_body');
      }
      break;

    case 'phase':
      break;
  }
}

function finish(): void {
  if (stage === 'done' || stage === 'calibrated') return;

  clearInterval(restTimer);
  els.between.hidden = true;
  // "Finish" mid-exercise still counts what was done in it.
  if (stage === 'setup' || stage === 'active') recordCurrentResult();

  const captured = calFrames;
  const replayFrames = sessionFrames;

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

  renderSummary();
  showScreen('done');
  speak('cue.session_complete');
  setupReplay(replayFrames);

  if (wantsVideo) {
    videoPromise.then((blob) => {
      if (blob) showVideoCard(blob);
    });
  }
}

function renderSummary(): void {
  const done = results.flatMap((r) => (r.summary ? [{ ...r, summary: r.summary }] : []));
  const totalReps = done.reduce((sum, r) => sum + r.summary.reps, 0);
  const totalMs = done.reduce((sum, r) => sum + r.summary.durationMs, 0);
  // Mean quality weighted by reps, so a 1-rep exercise does not count as much
  // as a full set of ten.
  let qualitySum = 0;
  let ratedReps = 0;
  for (const r of done) {
    if (r.summary.quality === null || r.summary.reps === 0) continue;
    qualitySum += r.summary.quality * r.summary.reps;
    ratedReps += r.summary.reps;
  }
  const quality = ratedReps ? Math.round(qualitySum / ratedReps) : null;

  els.doneTitle.textContent = t(totalReps > 0 ? 'done.title' : 'done.titleNone');
  els.sumReps.textContent = String(totalReps);
  els.sumQuality.textContent = quality === null ? '—' : `${quality}%`;
  els.sumDuration.textContent = formatDuration(totalMs);

  // One row per exercise in the programme, including ones never reached, so
  // the patient (and clinician) sees the whole plan against what was done.
  els.sumExercises.innerHTML = '';
  for (let i = 0; i < program.length; i++) {
    const item = program[i]!;
    const s = results[i]?.summary;
    const li = document.createElement('li');
    li.className = 'result-list__item';
    const name = document.createElement('span');
    name.className = 'result-list__name';
    name.textContent = exerciseName(getExercise(item.exerciseId).nameKey, getLocale());
    const meta = document.createElement('span');
    meta.className = 'result-list__meta';

    if (!s || (s.reps === 0 && s.durationMs === 0)) {
      meta.textContent = t('done.notDone');
      li.classList.add('result-list__item--muted');
    } else {
      const parts = [`${s.reps}/${item.targetReps} ${t('done.repsShort')}`];
      if (s.quality !== null) parts.push(`${t('done.quality')} ${s.quality}%`);
      if (s.bestPeakDeg !== null) parts.push(`~${Math.round(s.bestPeakDeg)}°`);
      meta.textContent = parts.join(' · ');
    }
    li.append(name, meta);
    els.sumExercises.append(li);
  }

  const cueCounts = new Map<string, number>();
  for (const r of done) {
    for (const [id, n] of Object.entries(r.summary.cues)) {
      const label = cueLabel(r.def, id);
      cueCounts.set(label, (cueCounts.get(label) ?? 0) + n);
    }
  }
  els.sumCues.innerHTML = cueCounts.size
    ? `<b>${escapeHtml(t('done.cuesTitle'))}</b><br />` +
      [...cueCounts].map(([label, n]) => `${escapeHtml(label)} × ${n}`).join('<br />')
    : '';
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
    els.calVerdict.textContent = t('cal.impossible');
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
    els.calVerdict.textContent = t('cal.verdictOk', { reps: check.reps });
  } else {
    els.calVerdict.className = 'verdict bad';
    els.calVerdict.textContent = t('cal.verdictBad', {
      reps: check.reps,
      expected: check.expectedReps,
    });
  }

  els.calWarnings.innerHTML = report.warnings.length
    ? `<b>${escapeHtml(t('cal.warningsTitle'))}</b><br />` +
      report.warnings.map(escapeHtml).join('<br />')
    : '';

  calibratedJson = JSON.stringify(tuned, null, 2);
  els.calJson.textContent = calibratedJson;
}

async function copyCalibration(): Promise<void> {
  if (!calibratedJson) return;
  try {
    await navigator.clipboard.writeText(calibratedJson);
    els.btnCalCopy.textContent = t('cal.copied');
    setTimeout(() => (els.btnCalCopy.textContent = t('cal.copy')), 1500);
  } catch {
    els.calError.hidden = false;
    els.calError.textContent = t('cal.copyDenied');
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
  els.screenSession.hidden = next !== 'setup' && next !== 'active' && next !== 'between';
  if (next !== 'between') {
    clearInterval(restTimer);
    els.between.hidden = true;
  }
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
    const note = prompt(t('record.notePrompt')) ?? '';
    downloadFixture(recorder.stop(note, navigator.userAgent));
    els.btnRecord.classList.remove('chip--recording');
    els.btnRecordLabel.textContent = t('record.start');
  } else {
    recorder.start(def.id);
    els.btnRecord.classList.add('chip--recording');
    els.btnRecordLabel.textContent = t('record.stop');
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
    `visibility ${source instanceof WebPoseSource && source.modelReportsVisibility ? 'modèle' : 'heuristique'}`,
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
  if (name === 'NotAllowedError') return t('error.cameraDenied');
  if (name === 'NotFoundError') return t('error.cameraNotFound');
  if (!window.isSecureContext) return t('error.insecureContext');
  return e instanceof Error ? e.message : String(e);
}

/** Summary counts are keyed by rule id; show the patient the cue they heard. */
function cueLabel(exercise: ExerciseDefinition, ruleId: string): string {
  const rule = exercise.formRules.find((r) => r.id === ruleId);
  if (!rule) return ruleId;
  try {
    return say(rule.cueKey, getLocale());
  } catch {
    return ruleId;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}
