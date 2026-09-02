import type { BodyPart, CueSeverity, Side } from '@kine/shared';

export type SideSpec = 'auto' | 'left' | 'right';

/** The scalar the rep detector tracks. One per exercise, deliberately. */
export type SignalSpec =
  | { type: 'jointAngle'; joint: BodyPart }
  | { type: 'segmentTilt'; from: BodyPart; to: BodyPart };

export type FormRuleSpec =
  | FormRuleBase & { type: 'segmentTilt'; from: BodyPart; to: BodyPart; maxDeg: number }
  | FormRuleBase & { type: 'jointAngle'; joint: BodyPart; minDeg?: number; maxDeg?: number }
  | FormRuleBase & { type: 'velocity'; maxDegPerSec: number }
  | FormRuleBase & {
      type: 'landmarkDrift';
      part: BodyPart;
      axis: 'x' | 'y';
      /** Normalised image units (0..1). 0.04 is roughly 4% of frame height. */
      maxDelta: number;
    };

export interface FormRuleBase {
  id: string;
  cueKey: string;
  severity: CueSeverity;
  /** Rule must be continuously violated for this long before it fires. */
  debounceMs: number;
  /** Minimum gap between two firings of the same rule. Stops the app nagging. */
  cooldownMs: number;
}

export interface ExerciseDefinition {
  id: string;
  version: number;
  /** i18n key for the display name. Never a literal string. */
  nameKey: string;

  clinical: {
    status: 'draft' | 'clinically_approved';
    reviewedBy?: string;
    reviewedAt?: string;
  };

  camera: {
    view: 'side' | 'front';
    distanceM: number;
    height: string;
    setupCueKey: string;
  };

  /** Parts that must be visible for the engine to count anything. */
  requiredParts: BodyPart[];
  side: SideSpec;

  signal: SignalSpec;

  rep: {
    /**
     * Angle that counts as "reached the target position".
     * Direction is inferred: enterDeg > exitDeg means the signal increases
     * through the movement (e.g. knee extension), and vice versa.
     */
    enterDeg: number;
    /** Angle that counts as "returned to the start position". */
    exitDeg: number;
    /** Time that must be held at the target before the return leg counts. */
    minHoldMs: number;
    /** Reps faster than this are jitter, not repetitions. */
    minDurationMs: number;
    /** Reps slower than this are a rest, not a repetition. */
    maxDurationMs: number;
  };

  rom: {
    /** Peak angle a well-executed rep reaches. Drives the quality score. */
    goalPeakDeg: number;
    /** Below this, the rep is scored poorly but still counted. */
    minAcceptablePeakDeg: number;
  };

  tempo?: {
    idealMs: number;
  };

  formRules: FormRuleSpec[];

  safety: {
    maxSetDurationMs: number;
    stopOn: string[];
  };

  /** Free text for the clinical reviewer. Never shown to a patient. */
  notes?: string;
}

export type RepDirection = 'increasing' | 'decreasing';

export function repDirection(def: ExerciseDefinition): RepDirection {
  return def.rep.enterDeg > def.rep.exitDeg ? 'increasing' : 'decreasing';
}

export type { Side, BodyPart };
