import type {
  EngineEvent,
  Frame,
  Landmark,
  SessionSummary,
  Side,
} from '@kine/shared';
import { clamp, mean } from './math';
import { PoseSmoother } from './smoothing';
import { SideSelector } from './side';
import { VisibilityGate } from './visibility';
import { computeSignal } from './signal';
import { RepMachine } from './repMachine';
import { FormRuleEvaluator } from './formRules';
import { repDirection, type ExerciseDefinition } from './definition';
import type { OneEuroParams } from './oneEuro';

export interface ExerciseSessionOptions {
  smoothing?: OneEuroParams;
  minVisibility?: number;
  /** Disable smoothing in tests that feed already-clean synthetic data. */
  disableSmoothing?: boolean;
}

interface RepRecord {
  peakDeg: number;
  quality: number;
}

const CUE_PENALTY = { info: 5, warn: 10 } as const;

/**
 * Drives one exercise from a stream of pose frames.
 *
 * Deliberately platform-free: no DOM, no React Native, no camera. It takes
 * landmark frames in and emits coaching events out, which is what lets the same
 * engine serve the web slice and the native Android app without a second
 * implementation.
 */
export class ExerciseSession {
  private readonly smoother: PoseSmoother;
  private readonly sideSelector: SideSelector;
  private readonly gate: VisibilityGate;
  private readonly repMachine: RepMachine;
  private readonly formRules: FormRuleEvaluator;
  private readonly useSmoothing: boolean;

  private lastSignal: number | null = null;
  private lastT: number | null = null;
  private firstT: number | null = null;
  private currentSide: Side = 'left';

  private repStartLandmarks: Landmark[] | null = null;
  private cuePenaltyThisRep = 0;

  private readonly reps: RepRecord[] = [];
  private partialReps = 0;
  private readonly cueCounts: Record<string, number> = {};
  private framesTotal = 0;
  private framesTracked = 0;

  constructor(
    private readonly def: ExerciseDefinition,
    opts: ExerciseSessionOptions = {},
  ) {
    this.smoother = new PoseSmoother(opts.smoothing);
    this.useSmoothing = !opts.disableSmoothing;
    this.sideSelector = new SideSelector(def.side, def.requiredParts);
    this.gate = new VisibilityGate(def.requiredParts, opts.minVisibility);
    this.repMachine = new RepMachine(def);
    this.formRules = new FormRuleEvaluator(def.formRules);
  }

  get side(): Side {
    return this.currentSide;
  }

  get repCount(): number {
    return this.repMachine.completedReps;
  }

  push(frame: Frame): EngineEvent[] {
    const events: EngineEvent[] = [];
    this.framesTotal++;
    this.firstT ??= frame.t;

    const f = this.useSmoothing ? this.smoother.smooth(frame) : frame;
    this.currentSide = this.sideSelector.update(f);

    const vis = this.gate.update(f, this.currentSide);
    if (vis.changed) {
      events.push({ kind: 'visibility', ok: vis.ok, missing: vis.missing });
    }
    if (!vis.ok) {
      this.repMachine.interrupt();
      this.lastSignal = null;
      this.lastT = frame.t;
      return events;
    }

    const signal = computeSignal(f, this.def.signal, this.currentSide);
    if (signal === null) {
      this.lastT = frame.t;
      return events;
    }
    this.framesTracked++;

    const dtSec =
      this.lastT !== null && frame.t > this.lastT ? (frame.t - this.lastT) / 1000 : 0;
    const velocity =
      dtSec > 0 && this.lastSignal !== null ? (signal - this.lastSignal) / dtSec : 0;

    const out = this.repMachine.update(signal, frame.t);

    if (out.phaseChanged) {
      events.push({ kind: 'phase', phase: out.phase });
      if (out.phase === 'concentric' && this.repStartLandmarks === null) {
        this.repStartLandmarks = f.landmarks;
        this.cuePenaltyThisRep = 0;
      }
    }

    if (out.rep) {
      const quality = this.scoreRep(out.rep.peakDeg, out.rep.durationMs);
      this.reps.push({ peakDeg: out.rep.peakDeg, quality });
      events.push({
        kind: 'rep',
        index: this.repMachine.completedReps,
        peakDeg: round1(out.rep.peakDeg),
        sweepDeg: round1(out.rep.sweepDeg),
        durationMs: out.rep.durationMs,
        quality,
      });
      this.repStartLandmarks = null;
    }

    if (out.partial) {
      this.partialReps++;
      events.push({
        kind: 'partialRep',
        peakDeg: round1(out.partial.peakDeg),
        shortfallDeg: round1(out.partial.shortfallDeg),
      });
      this.repStartLandmarks = null;
    }

    // Form rules only run inside a repetition. Outside one the patient is
    // resting or repositioning, and correcting their posture then is noise.
    if (this.repMachine.isInRep) {
      const cues = this.formRules.evaluate({
        frame: f,
        side: this.currentSide,
        velocityDegPerSec: velocity,
        repStartLandmarks: this.repStartLandmarks,
      });
      for (const c of cues) {
        this.cueCounts[c.ruleId] = (this.cueCounts[c.ruleId] ?? 0) + 1;
        this.cuePenaltyThisRep += CUE_PENALTY[c.severity];
        events.push(c);
      }
    }

    this.lastSignal = signal;
    this.lastT = frame.t;
    return events;
  }

  summary(): SessionSummary {
    const peaks = this.reps.map((r) => r.peakDeg);
    const dir = repDirection(this.def);
    const best =
      peaks.length === 0
        ? null
        : dir === 'increasing'
          ? Math.max(...peaks)
          : Math.min(...peaks);

    return {
      exerciseId: this.def.id,
      exerciseVersion: this.def.version,
      reps: this.reps.length,
      partialReps: this.partialReps,
      quality: this.reps.length ? Math.round(mean(this.reps.map((r) => r.quality))) : null,
      bestPeakDeg: best === null ? null : round1(best),
      meanPeakDeg: peaks.length ? round1(mean(peaks)) : null,
      durationMs: this.firstT !== null && this.lastT !== null ? this.lastT - this.firstT : 0,
      cues: { ...this.cueCounts },
      trackingQuality: this.framesTotal ? this.framesTracked / this.framesTotal : 0,
    };
  }

  reset(): void {
    this.smoother.reset();
    this.sideSelector.reset();
    this.gate.reset();
    this.formRules.reset();
    this.repMachine.interrupt();
    this.lastSignal = null;
    this.lastT = null;
    this.firstT = null;
    this.repStartLandmarks = null;
    this.reps.length = 0;
    this.partialReps = 0;
    this.framesTotal = 0;
    this.framesTracked = 0;
    for (const k of Object.keys(this.cueCounts)) delete this.cueCounts[k];
  }

  /**
   * 0..100. Range achieved dominates, tempo modulates, fired cues subtract.
   * The patient never sees this number directly — it feeds the "your movement
   * is improving" trend. The clinician sees it aggregated.
   */
  private scoreRep(peakDeg: number, durationMs: number): number {
    const s = repDirection(this.def) === 'increasing' ? 1 : -1;
    const { goalPeakDeg, minAcceptablePeakDeg } = this.def.rom;
    const span = s * goalPeakDeg - s * minAcceptablePeakDeg;
    const romScore =
      span > 0 ? clamp((s * peakDeg - s * minAcceptablePeakDeg) / span, 0, 1) : 1;

    let tempoScore = 1;
    if (this.def.tempo) {
      const ideal = this.def.tempo.idealMs;
      tempoScore = clamp(1 - Math.abs(durationMs - ideal) / ideal, 0, 1);
    }

    const raw = 100 * (0.7 * romScore + 0.3 * tempoScore) - this.cuePenaltyThisRep;
    return Math.round(clamp(raw, 0, 100));
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
