import type { BodyPart, Side } from './landmarks.js';

/**
 * A single pose landmark in normalised image coordinates.
 * x, y are 0..1 relative to the frame. z is depth (unreliable on a single
 * camera — the engine deliberately never uses it for clinical signals).
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** One pose observation. `t` is milliseconds, monotonic within a session. */
export interface Frame {
  t: number;
  landmarks: Landmark[];
}

export type EnginePhase = 'idle' | 'ready' | 'concentric' | 'hold' | 'eccentric';

export type CueSeverity = 'info' | 'warn';

export interface RepEvent {
  kind: 'rep';
  index: number;
  /** Extreme angle reached in the movement direction. Reported as ESTIMATED. */
  peakDeg: number;
  /** Total angular sweep of the repetition (max - min). */
  sweepDeg: number;
  durationMs: number;
  /** 0..100, combining range achieved, tempo, and cues fired during the rep. */
  quality: number;
}

/**
 * The patient moved but never reached the target range. This is what drives
 * "try extending your leg a little further" — it is NOT counted as a rep.
 */
export interface PartialRepEvent {
  kind: 'partialRep';
  peakDeg: number;
  shortfallDeg: number;
}

export interface FormCueEvent {
  kind: 'formCue';
  ruleId: string;
  severity: CueSeverity;
  cueKey: string;
}

export interface VisibilityEvent {
  kind: 'visibility';
  ok: boolean;
  /** Body parts the model cannot currently see, e.g. ['knee','ankle']. */
  missing: BodyPart[];
}

export interface PhaseEvent {
  kind: 'phase';
  phase: EnginePhase;
}

export type EngineEvent =
  | RepEvent
  | PartialRepEvent
  | FormCueEvent
  | VisibilityEvent
  | PhaseEvent;

export interface SessionSummary {
  exerciseId: string;
  exerciseVersion: number;
  reps: number;
  partialReps: number;
  /** Mean rep quality, 0..100. Null when no rep completed. */
  quality: number | null;
  /** Best estimated peak angle across reps. Presented as a TREND, never as a measurement. */
  bestPeakDeg: number | null;
  meanPeakDeg: number | null;
  durationMs: number;
  /** Count of each form cue fired, keyed by rule id. */
  cues: Record<string, number>;
  /** Fraction of frames where required landmarks were visible, 0..1. */
  trackingQuality: number;
}

/**
 * The payload that is allowed to leave the device. Deliberately contains no
 * imagery and no raw landmarks — see the privacy architecture in the plan.
 */
export interface SessionReport extends SessionSummary {
  startedAt: string;
  side: Side;
  appVersion: string;
}

export type { BodyPart, Side };
