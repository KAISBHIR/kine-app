import {
  countWord,
  exerciseName,
  landmarkIndex,
  say,
  type EngineEvent,
  type Frame,
  type Locale,
} from '@kine/shared';
import { ExerciseSession, computeSignal, type ExerciseDefinition } from '@kine/movement-engine';
import { getExercise, listExercises } from '@kine/exercise-library';
import { LandmarkRecorder } from '@kine/pose-source';
import { WebPoseSource } from '@kine/pose-source/web';
import { drawSkeleton, fitOverlay } from './skeleton';
import { WebSpeechVoice } from './voice';
import { downloadFixture } from './recorder';

const LOCALE: Locale = 'fr';

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
  screenStart: must<HTMLElement>('screen-start'),
  screenSession: must<HTMLElement>('screen-session'),
  screenDone: must<HTMLElement>('screen-done'),
  exerciseSelect: must<HTMLSelectElement>('exercise-select'),
  targetSelect: must<HTMLSelectElement>('target-select'),
  btnStart: must<HTMLButtonElement>('btn-start'),
  btnStop: must<HTMLButtonElement>('btn-stop'),
  btnAgain: must<HTMLButtonElement>('btn-again'),
  btnRecord: must<HTMLButtonElement>('btn-record'),
  btnDebug: must<HTMLButtonElement>('btn-debug'),
  startError: must<HTMLElement>('start-error'),
  video: must<HTMLVideoElement>('video'),
  overlay: must<HTMLCanvasElement>('overlay'),
  repDone: must<HTMLElement>('rep-done'),
  repTarget: must<HTMLElement>('rep-target'),
  status: must<HTMLElement>('status'),
  cue: must<HTMLElement>('cue'),
  debug: must<HTMLElement>('debug'),
  sumReps: must<HTMLElement>('sum-reps'),
  sumQuality: must<HTMLElement>('sum-quality'),
  sumDuration: must<HTMLElement>('sum-duration'),
  sumRom: must<HTMLElement>('sum-rom'),
  sumCues: must<HTMLElement>('sum-cues'),
};

const ctx = els.overlay.getContext('2d')!;
const voice = new WebSpeechVoice(LOCALE);
const recorder = new LandmarkRecorder();

type Stage = 'idle' | 'setup' | 'active' | 'done';

let stage: Stage = 'idle';
let source: WebPoseSource | null = null;
let session: ExerciseSession | null = null;
let def: ExerciseDefinition = getExercise('seated_knee_extension');
let targetReps = 10;

let setupGoodSince: number | null = null;
let lastPartialCueAt = -Infinity;
let cueHideTimer = 0;
let trackingOk = true;

// FPS is measured rather than assumed: it is the first number to look at when
// rep detection misbehaves on a particular phone.
let fpsWindow: number[] = [];
let lastFrameT = 0;
let debugVisible = false;

// --- boot ----------------------------------------------------------------

for (const d of listExercises()) {
  const opt = document.createElement('option');
  opt.value = d.id;
  opt.textContent = exerciseName(d.nameKey, LOCALE);
  els.exerciseSelect.append(opt);
}
els.exerciseSelect.value = def.id;

els.btnStart.addEventListener('click', () => void beginSession());
els.btnStop.addEventListener('click', () => finishSession());
els.btnAgain.addEventListener('click', () => showScreen('idle'));
els.btnDebug.addEventListener('click', () => {
  debugVisible = !debugVisible;
  els.debug.hidden = !debugVisible;
});
els.btnRecord.addEventListener('click', () => toggleRecording());
window.addEventListener('resize', () => fitOverlay(els.video, els.overlay));

// --- session lifecycle ---------------------------------------------------

async function beginSession(): Promise<void> {
  els.startError.hidden = true;
  def = getExercise(els.exerciseSelect.value);
  targetReps = Number(els.targetSelect.value);

  session = new ExerciseSession(def);
  setupGoodSince = null;
  lastPartialCueAt = -Infinity;
  trackingOk = true;
  fpsWindow = [];

  els.repDone.textContent = '0';
  els.repTarget.textContent = String(targetReps);
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
  } else if (stage === 'active' && session) {
    for (const ev of session.push(frame)) handleEvent(ev);
  }

  if (debugVisible) renderDebug(frame);
}

function handleSetup(frame: Frame): void {
  const visible = bodyVisible(frame);
  if (!visible) {
    setupGoodSince = null;
    setStatus('Reculez, je dois voir tout votre corps', 'lost');
    return;
  }

  setupGoodSince ??= frame.t;
  const held = frame.t - setupGoodSince;
  if (held < SETUP_STABLE_MS) {
    setStatus('Ne bougez pas…', '');
    return;
  }

  stage = 'active';
  setStatus('Prêt', 'ok');
  speak('cue.setup_ready');
  setTimeout(() => speak('cue.start'), 1400);
}

function handleEvent(ev: EngineEvent): void {
  switch (ev.kind) {
    case 'rep': {
      els.repDone.textContent = String(ev.index);
      if (ev.index <= 15) voice.say(countWord(ev.index, LOCALE), 'count');
      if (ev.index >= targetReps) finishSession();
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

function finishSession(): void {
  if (stage === 'done') return;

  const summary = session?.summary() ?? null;
  source?.stop();
  source = null;
  voice.stop();

  if (recorder.isRecording) toggleRecording();

  if (summary) {
    els.sumReps.textContent = String(summary.reps);
    els.sumQuality.textContent = summary.quality === null ? '—' : `${summary.quality}%`;
    els.sumDuration.textContent = formatDuration(summary.durationMs);
    els.sumRom.textContent =
      summary.bestPeakDeg === null ? '—' : `${Math.round(summary.bestPeakDeg)}°`;

    const cueEntries = Object.entries(summary.cues);
    els.sumCues.innerHTML = cueEntries.length
      ? `<b>Rappels donnés</b><br />` +
        cueEntries.map(([id, n]) => `${escapeHtml(id)} × ${n}`).join('<br />')
      : '';
  }

  showScreen('done');
  speak('cue.session_complete');
}

// --- helpers -------------------------------------------------------------

function showScreen(next: Stage): void {
  stage = next;
  els.screenStart.hidden = next !== 'idle';
  els.screenSession.hidden = next !== 'setup' && next !== 'active';
  els.screenDone.hidden = next !== 'done';

  if (next === 'idle') {
    source?.stop();
    source = null;
    session = null;
  }
}

/** All required parts visible on at least one side. */
function bodyVisible(frame: Frame): boolean {
  const ok = (side: 'left' | 'right') =>
    def.requiredParts.every((p) => (frame.landmarks[landmarkIndex(p, side)]?.visibility ?? 0) > 0.6);
  return ok('left') || ok('right');
}

function trackedLimbIndices(): number[] {
  const side = session?.side ?? 'left';
  return def.requiredParts.map((p) => landmarkIndex(p, side));
}

function setStatus(text: string, cls: string): void {
  els.status.textContent = text;
  els.status.className = `status ${cls}`;
}

function speak(cueKey: string): void {
  voice.say(say(cueKey, LOCALE), 'cue');
}

function showCue(cueKey: string): void {
  const text = say(cueKey, LOCALE);
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
    els.btnRecord.textContent = '● Enregistrer';
  } else {
    recorder.start(def.id);
    els.btnRecord.textContent = '■ Arrêter';
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
    `exercice   ${def.id}`,
    `étape      ${stage}`,
    `côté       ${side}`,
    `angle brut ${angle === null ? '—' : angle.toFixed(1) + '°'}`,
    `seuils     ${def.rep.exitDeg}° / ${def.rep.enterDeg}°`,
    `reps       ${session?.repCount ?? 0} / ${targetReps}`,
    `suivi      ${trackingOk ? 'ok' : 'perdu'}`,
    `visibility ${source?.modelReportsVisibility ? 'modèle' : 'heuristique'}`,
    `fps        ${fps.toFixed(1)}`,
    `frames     ${recorder.isRecording ? recorder.frameCount + ' (rec)' : '—'}`,
  ].join('\n');
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') {
    return "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.";
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
