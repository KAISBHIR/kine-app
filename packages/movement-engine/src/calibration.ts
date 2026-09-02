import {
  landmarkIndex,
  type BodyPart,
  type Frame,
  type SessionSummary,
  type Side,
} from '@kine/shared';
import { clamp, mean } from './math';
import { PoseSmoother } from './smoothing';
import { SideSelector } from './side';
import { computeSignal } from './signal';
import { ExerciseSession } from './session';
import type { ExerciseDefinition, SideSpec, SignalSpec } from './definition';

/**
 * Derives exercise thresholds from a recording instead of guessing them.
 *
 * Every threshold in an exercise definition — where a repetition starts, where
 * it counts as complete, what a good range looks like, how long a rep takes —
 * is a number about a particular body doing a particular movement in front of a
 * particular camera. Guessed values produce a rep counter that is confidently
 * wrong.
 *
 * This takes a recording of someone performing the movement and reports what
 * actually happened: the resting angle, the range achieved, how long each
 * repetition took, and thresholds that fit. Then `verifyCalibration` feeds them
 * back through the engine to check they reproduce the repetitions a human can
 * count in the recording.
 *
 * IMPORTANT: this fits numbers to observed movement. It does not know whether
 * the movement was clinically correct, safe, or appropriate for the patient.
 * A clinician still decides what the exercise should be; this only measures
 * what it was.
 */

export interface CalibrationInput {
  frames: Frame[];
  signal: SignalSpec;
  requiredParts: BodyPart[];
  side?: SideSpec;
  /** Landmarks below this are treated as untracked. */
  minVisibility?: number;
}

export interface CalibrationCycle {
  startMs: number;
  endMs: number;
  durationMs: number;
  peakDeg: number;
  /** Time spent at or beyond the suggested target threshold. */
  dwellMs: number;
  /** False when the movement never reached the target band. */
  complete: boolean;
}

export interface SuggestedThresholds {
  rep: {
    enterDeg: number;
    exitDeg: number;
    minHoldMs: number;
    minDurationMs: number;
    maxDurationMs: number;
  };
  rom: {
    goalPeakDeg: number;
    minAcceptablePeakDeg: number;
  };
  tempo: {
    idealMs: number;
  };
}

export interface CalibrationReport {
  side: Side;
  frameCount: number;
  durationMs: number;
  measuredFps: number;
  /** Fraction of frames where every required landmark was visible. */
  trackingQuality: number;

  /** Angle the body rests at between repetitions. */
  restDeg: number;
  /** Furthest angle reached, in the direction of movement. */
  peakDeg: number;
  rangeDeg: number;
  direction: 'increasing' | 'decreasing';

  cycles: CalibrationCycle[];
  suggested: SuggestedThresholds;
  warnings: string[];
}

const MIN_SAMPLES = 30;
/** Below this the movement is too small to fit thresholds to. */
const MIN_RANGE_DEG = 12;

/** Where the repetition is considered started, as a fraction of the range. */
const EXIT_FRACTION = 0.15;
/** Where it is considered to have reached target. */
const ENTER_FRACTION = 0.8;
/** Below this fraction of range, a repetition scores poorly but still counts. */
const MIN_ACCEPTABLE_FRACTION = 0.65;

export function calibrate(input: CalibrationInput): CalibrationReport {
  const smoother = new PoseSmoother();
  const sideSelector = new SideSelector(input.side ?? 'auto', input.requiredParts);
  const minVis = input.minVisibility ?? 0.5;

  const warnings: string[] = [];
  const samples: Array<{ t: number; v: number }> = [];
  let side: Side = 'left';

  for (const raw of input.frames) {
    const f = smoother.smooth(raw);
    side = sideSelector.update(f);

    const visible = input.requiredParts.every(
      (p) => (f.landmarks[landmarkIndex(p, side)]?.visibility ?? 0) >= minVis,
    );
    if (!visible) continue;

    const v = computeSignal(f, input.signal, side);
    if (v === null) continue;
    samples.push({ t: f.t, v });
  }

  const frameCount = input.frames.length;
  const trackingQuality = frameCount ? samples.length / frameCount : 0;

  if (samples.length < MIN_SAMPLES) {
    throw new Error(
      `Not enough usable frames to calibrate: ${samples.length} of ${frameCount}. ` +
        `Check that the whole body is in shot for the entire recording.`,
    );
  }

  const first = input.frames[0]!;
  const last = input.frames[frameCount - 1]!;
  const durationMs = last.t - first.t;
  const measuredFps = durationMs > 0 ? round1((frameCount / durationMs) * 1000) : 0;

  const values = samples.map((s) => s.v);
  const restDeg = modeDeg(values);
  const peakDeg = furthestFromRest(values, restDeg);
  const rangeDeg = Math.abs(peakDeg - restDeg);
  const direction: 'increasing' | 'decreasing' =
    peakDeg >= restDeg ? 'increasing' : 'decreasing';

  if (rangeDeg < MIN_RANGE_DEG) {
    throw new Error(
      `Movement range is only ${rangeDeg.toFixed(1)}°, too small to calibrate. ` +
        `Either the camera cannot see the movement, or the wrong joint is being tracked.`,
    );
  }

  const sign = direction === 'increasing' ? 1 : -1;
  const exitDeg = restDeg + sign * rangeDeg * EXIT_FRACTION;
  const enterDeg = restDeg + sign * rangeDeg * ENTER_FRACTION;

  const cycles = segmentCycles(samples, {
    sign,
    exitDeg,
    enterDeg,
    band: rangeDeg * 0.05,
  });

  const complete = cycles.filter((c) => c.complete);

  if (complete.length === 0) {
    warnings.push(
      'No complete repetitions detected. The suggested thresholds are based on ' +
        'range alone and should not be trusted.',
    );
  } else if (complete.length < 3) {
    warnings.push(
      `Only ${complete.length} complete repetition(s) in this recording. ` +
        'Record at least 5 for stable timing values.',
    );
  }

  if (trackingQuality < 0.9) {
    warnings.push(
      `The body was fully visible in only ${Math.round(trackingQuality * 100)}% of frames. ` +
        'Move the camera back or improve the lighting and record again.',
    );
  }

  if (measuredFps < 20) {
    warnings.push(
      `Recorded at ${measuredFps} fps. Below about 20 fps the rep detector starts ` +
        'missing fast movements.',
    );
  }

  const peaks = complete.map((c) => c.peakDeg);
  if (peaks.length >= 3) {
    const spread = Math.max(...peaks.map((p) => Math.abs(p - mean(peaks))));
    if (spread > rangeDeg * 0.25) {
      warnings.push(
        `Peak angle varied by up to ${spread.toFixed(0)}° between repetitions. ` +
          'The suggested target may be too strict or too lenient for a typical rep.',
      );
    }
  }

  const durations = complete.map((c) => c.durationMs);
  const dwells = complete.map((c) => c.dwellMs);

  const medianDuration = durations.length ? median(durations) : 3000;
  const medianDwell = dwells.length ? median(dwells) : 400;
  const bestPeak = peaks.length
    ? peaks.reduce((a, b) => (sign * b > sign * a ? b : a))
    : peakDeg;

  const suggested: SuggestedThresholds = {
    rep: {
      enterDeg: round1(enterDeg),
      exitDeg: round1(exitDeg),
      // Half the observed dwell, so a slightly rushed rep still counts.
      minHoldMs: Math.round(clamp(medianDwell * 0.5, 150, 1500)),
      minDurationMs: Math.round(clamp(medianDuration * 0.4, 400, 5000)),
      maxDurationMs: Math.round(clamp(medianDuration * 3, 4000, 30000)),
    },
    rom: {
      goalPeakDeg: round1(bestPeak),
      minAcceptablePeakDeg: round1(restDeg + sign * rangeDeg * MIN_ACCEPTABLE_FRACTION),
    },
    tempo: {
      idealMs: Math.round(medianDuration),
    },
  };

  return {
    side,
    frameCount,
    durationMs,
    measuredFps,
    trackingQuality: round2(trackingQuality),
    restDeg: round1(restDeg),
    peakDeg: round1(peakDeg),
    rangeDeg: round1(rangeDeg),
    direction,
    cycles,
    suggested,
    warnings,
  };
}

/**
 * Applies suggested thresholds to a definition, leaving everything a clinician
 * owns — the cues, the form rules, the safety block, the approval status —
 * untouched. Calibration never promotes a definition out of `draft`.
 */
export function applySuggestion(
  def: ExerciseDefinition,
  suggested: SuggestedThresholds,
): ExerciseDefinition {
  return {
    ...def,
    rep: { ...def.rep, ...suggested.rep },
    rom: { ...def.rom, ...suggested.rom },
    tempo: { ...suggested.tempo },
  };
}

export interface CalibrationVerification {
  /** Repetitions the engine counts using the calibrated definition. */
  reps: number;
  /** Complete movements the calibration analysis saw in the same recording. */
  expectedReps: number;
  agrees: boolean;
  summary: SessionSummary;
}

/**
 * The check that makes calibration trustworthy: feed the suggested thresholds
 * back through the real engine, against the same recording, and confirm it
 * counts the repetitions that are actually in it.
 *
 * If this disagrees, do not ship the numbers — the recording is probably too
 * short, too dark, or of the wrong movement.
 */
export function verifyCalibration(
  frames: Frame[],
  def: ExerciseDefinition,
  report: CalibrationReport,
): CalibrationVerification {
  const session = new ExerciseSession(def);
  for (const f of frames) session.push(f);

  const summary = session.summary();
  const expectedReps = report.cycles.filter((c) => c.complete).length;

  return {
    reps: summary.reps,
    expectedReps,
    agrees: summary.reps === expectedReps,
    summary,
  };
}

// --- cycle segmentation --------------------------------------------------

function segmentCycles(
  samples: Array<{ t: number; v: number }>,
  cfg: { sign: number; exitDeg: number; enterDeg: number; band: number },
): CalibrationCycle[] {
  const { sign, band } = cfg;
  const p = (v: number) => sign * v;
  const pExit = p(cfg.exitDeg);
  const pEnter = p(cfg.enterDeg);

  const cycles: CalibrationCycle[] = [];

  let above = false;
  let startMs = 0;
  let peakP = -Infinity;
  let dwellMs = 0;
  let reachedEnter = false;
  let lastT: number | null = null;
  // Skip any partial movement already in progress when recording began.
  let armed = false;

  for (const s of samples) {
    const cur = p(s.v);
    const dt = lastT === null ? 0 : Math.min(Math.max(s.t - lastT, 0), 200);
    lastT = s.t;

    if (!armed) {
      if (cur <= pExit) armed = true;
      continue;
    }

    if (!above) {
      if (cur > pExit + band) {
        above = true;
        startMs = s.t;
        peakP = cur;
        dwellMs = 0;
        reachedEnter = false;
      }
      continue;
    }

    if (cur > peakP) peakP = cur;
    if (cur >= pEnter) {
      reachedEnter = true;
      dwellMs += dt;
    }

    if (cur <= pExit) {
      above = false;
      cycles.push({
        startMs,
        endMs: s.t,
        durationMs: s.t - startMs,
        peakDeg: round1(sign * peakP),
        dwellMs: Math.round(dwellMs),
        complete: reachedEnter,
      });
    }
  }

  return cycles;
}

// --- statistics ----------------------------------------------------------

/** Resting angle: the value the body spends most of its time at. */
function modeDeg(values: number[]): number {
  const bins = new Map<number, number>();
  for (const v of values) {
    const b = Math.round(v);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }

  let bestBin = 0;
  let bestCount = -1;
  for (const [b, c] of bins) {
    if (c > bestCount) {
      bestCount = c;
      bestBin = b;
    }
  }

  // Average the samples in the winning bin and its neighbours, so the answer
  // is not quantised to a whole degree.
  const near = values.filter((v) => Math.abs(v - bestBin) <= 1.5);
  return near.length ? mean(near) : bestBin;
}

/**
 * The extreme the movement reaches. Uses a high percentile rather than the
 * outright maximum so one bad frame cannot define the target.
 */
function furthestFromRest(values: number[], rest: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const low = percentile(sorted, 0.02);
  const high = percentile(sorted, 0.98);
  return Math.abs(high - rest) >= Math.abs(low - rest) ? high : low;
}

function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const i = clamp(Math.round((sortedAsc.length - 1) * q), 0, sortedAsc.length - 1);
  return sortedAsc[i]!;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length === 0) return 0;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
