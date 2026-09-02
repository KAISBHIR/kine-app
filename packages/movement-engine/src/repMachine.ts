import type { EnginePhase } from '@kine/shared';
import { repDirection, type ExerciseDefinition, type RepDirection } from './definition.js';

export interface CompletedRep {
  peakDeg: number;
  sweepDeg: number;
  durationMs: number;
  startedAt: number;
}

export interface PartialAttempt {
  peakDeg: number;
  shortfallDeg: number;
}

export interface RepMachineOutput {
  phase: EnginePhase;
  phaseChanged: boolean;
  rep?: CompletedRep;
  partial?: PartialAttempt;
}

/** A partial attempt is only reported if the patient genuinely tried to move. */
const PARTIAL_MIN_EXCURSION_DEG = 4;

/**
 * Hysteresis rep detector.
 *
 * Two separate thresholds (enter/exit) instead of one midpoint is what stops a
 * patient hovering near the boundary from racking up dozens of phantom reps.
 * The hold requirement stops a bounce at the top from counting, and the
 * duration bounds discard both twitches and abandoned attempts.
 *
 * Internally everything is expressed in "progress space", where larger always
 * means closer to the target, so a single implementation serves exercises whose
 * angle increases (knee extension) and decreases (elbow flexion) alike.
 */
export class RepMachine {
  private readonly dir: RepDirection;
  private readonly enterP: number;
  private readonly exitP: number;

  private phase: EnginePhase = 'idle';
  private repStartT = 0;
  private holdAccumMs = 0;
  private lastT: number | null = null;
  private peakP = -Infinity;
  private minP = Infinity;
  private repIndex = 0;

  constructor(private readonly def: ExerciseDefinition) {
    this.dir = repDirection(def);
    const s = this.dir === 'increasing' ? 1 : -1;
    this.enterP = s * def.rep.enterDeg;
    this.exitP = s * def.rep.exitDeg;
  }

  get completedReps(): number {
    return this.repIndex;
  }

  get currentPhase(): EnginePhase {
    return this.phase;
  }

  get isInRep(): boolean {
    return this.phase === 'concentric' || this.phase === 'hold' || this.phase === 'eccentric';
  }

  update(signalDeg: number, t: number): RepMachineOutput {
    const p = this.toProgress(signalDeg);
    const before = this.phase;
    let rep: CompletedRep | undefined;
    let partial: PartialAttempt | undefined;

    // Dwell time in the target zone ACCUMULATES across brief dips below the
    // threshold. Requiring it to be continuous looks equivalent and is not:
    // a patient holding a position right at the threshold crosses it back and
    // forth on sensor noise alone, and their perfectly good repetition gets
    // thrown away. Clamped so a dropped-frame gap cannot be credited as hold.
    const dt = this.lastT === null ? 0 : Math.min(Math.max(t - this.lastT, 0), 200);
    this.lastT = t;
    if (this.isInRep && p >= this.enterP) this.holdAccumMs += dt;

    switch (this.phase) {
      case 'idle':
        if (p <= this.exitP) this.phase = 'ready';
        break;

      case 'ready':
        if (p > this.exitP) {
          this.phase = 'concentric';
          this.repStartT = t;
          this.peakP = p;
          this.minP = p;
          this.holdAccumMs = 0;
        }
        break;

      case 'concentric':
        this.track(p);
        if (p >= this.enterP) {
          this.phase = 'hold';
        } else if (p <= this.exitP) {
          partial = this.buildPartial();
          this.phase = 'ready';
        } else if (t - this.repStartT > this.def.rep.maxDurationMs) {
          this.phase = 'ready';
        }
        break;

      case 'hold':
        this.track(p);
        if (p < this.enterP) {
          this.phase =
            this.holdAccumMs >= this.def.rep.minHoldMs ? 'eccentric' : 'concentric';
        }
        break;

      case 'eccentric':
        this.track(p);
        if (p >= this.enterP) {
          this.phase = 'hold';
        } else if (p <= this.exitP) {
          const durationMs = t - this.repStartT;
          if (
            durationMs >= this.def.rep.minDurationMs &&
            durationMs <= this.def.rep.maxDurationMs
          ) {
            this.repIndex++;
            rep = {
              peakDeg: this.fromProgress(this.peakP),
              sweepDeg: Math.abs(this.fromProgress(this.peakP) - this.fromProgress(this.minP)),
              durationMs,
              startedAt: this.repStartT,
            };
          }
          this.phase = 'ready';
        } else if (t - this.repStartT > this.def.rep.maxDurationMs) {
          this.phase = 'ready';
        }
        break;
    }

    const out: RepMachineOutput = { phase: this.phase, phaseChanged: this.phase !== before };
    if (rep) out.rep = rep;
    if (partial) out.partial = partial;
    return out;
  }

  /** Called when tracking is lost: abandon any rep in flight without counting it. */
  interrupt(): void {
    this.phase = 'idle';
    this.holdAccumMs = 0;
    this.lastT = null;
    this.peakP = -Infinity;
    this.minP = Infinity;
  }

  private track(p: number): void {
    if (p > this.peakP) this.peakP = p;
    if (p < this.minP) this.minP = p;
  }

  private buildPartial(): PartialAttempt | undefined {
    const excursion = this.peakP - this.exitP;
    if (excursion < PARTIAL_MIN_EXCURSION_DEG) return undefined;
    return {
      peakDeg: this.fromProgress(this.peakP),
      shortfallDeg: Math.round((this.enterP - this.peakP) * 10) / 10,
    };
  }

  private toProgress(signalDeg: number): number {
    return this.dir === 'increasing' ? signalDeg : -signalDeg;
  }

  private fromProgress(p: number): number {
    return this.dir === 'increasing' ? p : -p;
  }
}
