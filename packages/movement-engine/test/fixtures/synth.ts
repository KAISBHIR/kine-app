import { LANDMARK_COUNT, POSE_LANDMARK, type Frame, type Landmark } from '@kine/shared';

/**
 * Synthetic pose generator for a seated knee extension, side view.
 *
 * Real recordings replace these on Day 1 — but synthetic data is better than
 * recordings for one specific job: it has a KNOWN ground truth. We can assert
 * "these are exactly 10 repetitions peaking at 165 degrees" and hold the rep
 * detector to it. Recorded clips can only ever be eyeballed.
 *
 * Geometry: hip and knee are fixed (the patient is seated, thigh horizontal);
 * the shin swings about the knee. With knee->hip pointing along -x, a shin
 * direction of (cos a, sin a) in image coordinates (y down) gives a knee angle
 * of 180 - a. So a = 90 is a hanging shin (90 degrees of flexion) and a = 0 is
 * full extension.
 */

const SHIN = 0.2;
const THIGH = 0.12;
const HIP: Readonly<[number, number]> = [0.5, 0.55];

/** Deterministic PRNG so a failing test always fails the same way. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number): number {
  // Box-Muller.
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function lm(x: number, y: number, visibility: number): Landmark {
  return { x, y, z: 0, visibility };
}

export interface SkeletonOptions {
  /** Std-dev of positional noise in normalised units. 0.004 ~ realistic. */
  noise?: number;
  /** Vertical offset applied to the hip, for simulating hip lift. */
  hipLiftY?: number;
  /** Tilt of the torso away from vertical, degrees. */
  torsoTiltDeg?: number;
  /** Visibility forced onto the tracked leg, for dropout simulation. */
  legVisibility?: number;
}

export function skeletonForKneeAngle(
  kneeDeg: number,
  rnd: () => number,
  opts: SkeletonOptions = {},
): Landmark[] {
  const noise = opts.noise ?? 0;
  const legVis = opts.legVisibility ?? 0.92;
  const nearVis = 0.92;
  const farVis = 0.4;

  const hipX = HIP[0];
  const hipY = HIP[1] + (opts.hipLiftY ?? 0);

  const kneeX = hipX + THIGH;
  const kneeY = hipY;

  const a = ((180 - kneeDeg) * Math.PI) / 180;
  const ankleX = kneeX + SHIN * Math.cos(a);
  const ankleY = kneeY + SHIN * Math.sin(a);

  // Torso runs upward from the hip; tilt leans it forward (+x).
  const tilt = ((opts.torsoTiltDeg ?? 0) * Math.PI) / 180;
  const torsoLen = 0.23;
  const shoulderX = hipX + torsoLen * Math.sin(tilt);
  const shoulderY = hipY - torsoLen * Math.cos(tilt);

  const pts = new Array<Landmark>(LANDMARK_COUNT);
  for (let i = 0; i < LANDMARK_COUNT; i++) pts[i] = lm(0.5, 0.5, 0.1);

  const put = (idx: number, x: number, y: number, vis: number) => {
    const nx = noise > 0 ? x + gaussian(rnd) * noise : x;
    const ny = noise > 0 ? y + gaussian(rnd) * noise : y;
    pts[idx] = lm(nx, ny, vis);
  };

  const headY = shoulderY - 0.1;
  put(POSE_LANDMARK.NOSE, shoulderX + 0.02, headY, nearVis);
  put(POSE_LANDMARK.LEFT_EYE, shoulderX + 0.03, headY - 0.01, nearVis);
  put(POSE_LANDMARK.RIGHT_EYE, shoulderX + 0.025, headY - 0.01, farVis);
  put(POSE_LANDMARK.LEFT_EAR, shoulderX, headY - 0.005, nearVis);
  put(POSE_LANDMARK.RIGHT_EAR, shoulderX - 0.005, headY - 0.005, farVis);

  put(POSE_LANDMARK.LEFT_SHOULDER, shoulderX, shoulderY, nearVis);
  put(POSE_LANDMARK.RIGHT_SHOULDER, shoulderX + 0.005, shoulderY + 0.004, farVis);
  put(POSE_LANDMARK.LEFT_ELBOW, shoulderX + 0.03, shoulderY + 0.1, nearVis);
  put(POSE_LANDMARK.RIGHT_ELBOW, shoulderX + 0.035, shoulderY + 0.1, farVis);
  put(POSE_LANDMARK.LEFT_WRIST, shoulderX + 0.05, shoulderY + 0.18, nearVis);
  put(POSE_LANDMARK.RIGHT_WRIST, shoulderX + 0.055, shoulderY + 0.18, farVis);

  put(POSE_LANDMARK.LEFT_HIP, hipX, hipY, legVis);
  put(POSE_LANDMARK.RIGHT_HIP, hipX + 0.005, hipY + 0.004, farVis);
  put(POSE_LANDMARK.LEFT_KNEE, kneeX, kneeY, legVis);
  put(POSE_LANDMARK.RIGHT_KNEE, kneeX + 0.005, kneeY + 0.004, farVis);
  put(POSE_LANDMARK.LEFT_ANKLE, ankleX, ankleY, legVis);
  put(POSE_LANDMARK.RIGHT_ANKLE, ankleX + 0.005, ankleY + 0.004, farVis);
  put(POSE_LANDMARK.LEFT_HEEL, ankleX - 0.02, ankleY + 0.02, legVis);
  put(POSE_LANDMARK.RIGHT_HEEL, ankleX - 0.015, ankleY + 0.024, farVis);
  put(POSE_LANDMARK.LEFT_FOOT_INDEX, ankleX + 0.04, ankleY + 0.015, legVis);
  put(POSE_LANDMARK.RIGHT_FOOT_INDEX, ankleX + 0.045, ankleY + 0.019, farVis);

  return pts;
}

function smoothstep(u: number): number {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  return c * c * (3 - 2 * c);
}

export interface RepSpec {
  peakDeg: number;
  durationMs: number;
  holdMs: number;
}

export interface SequenceOptions extends SkeletonOptions {
  reps: RepSpec[];
  startDeg?: number;
  fps?: number;
  restMs?: number;
  /** Leading rest so the machine can settle into the start position. */
  leadInMs?: number;
  seed?: number;
  /** [startMs, endMs] windows where the tracked leg is not visible. */
  dropouts?: Array<[number, number]>;
  /** Per-rep overrides, applied while that rep is in progress. */
  perRep?: Array<SkeletonOptions | undefined>;
}

export interface SyntheticSequence {
  frames: Frame[];
  /** Ground-truth angle for each frame, for debugging a failing assertion. */
  angles: number[];
}

/** Builds a full frame sequence with known ground truth. */
export function generateKneeExtensionSequence(opts: SequenceOptions): SyntheticSequence {
  const fps = opts.fps ?? 30;
  const dt = 1000 / fps;
  const start = opts.startDeg ?? 90;
  const restMs = opts.restMs ?? 800;
  const leadInMs = opts.leadInMs ?? 700;
  const rnd = mulberry32(opts.seed ?? 1);

  const frames: Frame[] = [];
  const angles: number[] = [];
  let t = 0;

  const emit = (deg: number, extra?: SkeletonOptions) => {
    const dropped = (opts.dropouts ?? []).some(([a, b]) => t >= a && t <= b);
    const o: SkeletonOptions = {
      noise: opts.noise,
      hipLiftY: extra?.hipLiftY ?? opts.hipLiftY,
      torsoTiltDeg: extra?.torsoTiltDeg ?? opts.torsoTiltDeg,
      legVisibility: dropped ? 0.05 : (extra?.legVisibility ?? opts.legVisibility),
    };
    frames.push({ t, landmarks: skeletonForKneeAngle(deg, rnd, o) });
    angles.push(deg);
    t += dt;
  };

  for (let e = 0; e < leadInMs; e += dt) emit(start);

  opts.reps.forEach((rep, i) => {
    const extra = opts.perRep?.[i];
    const move = Math.max(rep.durationMs - rep.holdMs, dt * 2);
    const half = move / 2;

    for (let e = 0; e < half; e += dt) {
      emit(start + (rep.peakDeg - start) * smoothstep(e / half), extra);
    }
    for (let e = 0; e < rep.holdMs; e += dt) emit(rep.peakDeg, extra);
    for (let e = 0; e < half; e += dt) {
      emit(rep.peakDeg - (rep.peakDeg - start) * smoothstep(e / half), extra);
    }
    for (let e = 0; e < restMs; e += dt) emit(start, extra);
  });

  return { frames, angles };
}

/** Convenience: N identical clean repetitions. */
export function cleanReps(
  count: number,
  peakDeg = 165,
  durationMs = 4000,
  extra: Partial<SequenceOptions> = {},
): SyntheticSequence {
  return generateKneeExtensionSequence({
    reps: Array.from({ length: count }, () => ({ peakDeg, durationMs, holdMs: 700 })),
    ...extra,
  });
}
