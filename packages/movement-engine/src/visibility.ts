import { landmarkIndex, type BodyPart, type Frame, type Side } from '@kine/shared';

export interface VisibilityState {
  ok: boolean;
  missing: BodyPart[];
  /** True on the frame where the state flipped — the caller emits an event. */
  changed: boolean;
}

/**
 * Decides whether the engine can trust what it is seeing.
 *
 * When required landmarks drop out, the engine STOPS COUNTING rather than
 * guessing. Telling a patient "I can't see your leg" is recoverable; silently
 * inventing repetitions destroys the clinician's trust in every number the
 * product reports.
 *
 * Both directions are debounced so a single bad frame doesn't produce an
 * announcement, and a single good frame doesn't clear a real problem.
 */
export class VisibilityGate {
  private ok = true;
  private badSince: number | null = null;
  private goodSince: number | null = null;
  private lastMissing: BodyPart[] = [];

  constructor(
    private readonly parts: BodyPart[],
    private readonly minVisibility = 0.5,
    private readonly lossMs = 500,
    private readonly restoreMs = 300,
  ) {}

  update(frame: Frame, side: Side): VisibilityState {
    const missing: BodyPart[] = [];
    for (const part of this.parts) {
      const lm = frame.landmarks[landmarkIndex(part, side)];
      if (!lm || lm.visibility < this.minVisibility) missing.push(part);
    }

    const frameOk = missing.length === 0;
    let changed = false;

    if (frameOk) {
      this.badSince = null;
      if (!this.ok) {
        this.goodSince ??= frame.t;
        if (frame.t - this.goodSince >= this.restoreMs) {
          this.ok = true;
          changed = true;
          this.goodSince = null;
        }
      }
    } else {
      this.goodSince = null;
      this.lastMissing = missing;
      if (this.ok) {
        this.badSince ??= frame.t;
        if (frame.t - this.badSince >= this.lossMs) {
          this.ok = false;
          changed = true;
          this.badSince = null;
        }
      }
    }

    return { ok: this.ok, missing: this.ok ? [] : this.lastMissing, changed };
  }

  reset(): void {
    this.ok = true;
    this.badSince = null;
    this.goodSince = null;
    this.lastMissing = [];
  }
}
