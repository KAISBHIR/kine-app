import { landmarkIndex, type BodyPart, type Frame, type Side } from '@kine/shared';
import { mean } from './math.js';
import type { SideSpec } from './definition.js';

/**
 * Picks which side of the body to track.
 *
 * In a side-view exercise the far limb is partly occluded by the near one, so
 * the model reports it with low confidence. We take the more visible side and
 * then LOCK it: without the lock, a patient whose legs cross briefly would have
 * the engine swap limbs mid-repetition and lose the count.
 */
export class SideSelector {
  private locked: Side | null = null;
  private readonly leftScores: number[] = [];
  private readonly rightScores: number[] = [];

  constructor(
    private readonly spec: SideSpec,
    private readonly parts: BodyPart[],
    private readonly warmupFrames = 20,
  ) {
    if (spec === 'left' || spec === 'right') this.locked = spec;
  }

  update(frame: Frame): Side {
    if (this.locked) {
      // Only reconsider if the locked side has essentially disappeared while
      // the other one is clearly visible — e.g. the patient turned around.
      const l = this.score(frame, 'left');
      const r = this.score(frame, 'right');
      const other = this.locked === 'left' ? r : l;
      const mine = this.locked === 'left' ? l : r;
      if (mine < 0.25 && other > 0.7) this.locked = this.locked === 'left' ? 'right' : 'left';
      return this.locked;
    }

    this.leftScores.push(this.score(frame, 'left'));
    this.rightScores.push(this.score(frame, 'right'));

    if (this.leftScores.length >= this.warmupFrames) {
      this.locked = mean(this.leftScores) >= mean(this.rightScores) ? 'left' : 'right';
      return this.locked;
    }

    return mean(this.leftScores) >= mean(this.rightScores) ? 'left' : 'right';
  }

  get isLocked(): boolean {
    return this.locked !== null;
  }

  private score(frame: Frame, side: Side): number {
    const vs: number[] = [];
    for (const part of this.parts) {
      const lm = frame.landmarks[landmarkIndex(part, side)];
      vs.push(lm ? lm.visibility : 0);
    }
    return mean(vs);
  }

  reset(): void {
    this.locked = this.spec === 'left' || this.spec === 'right' ? this.spec : null;
    this.leftScores.length = 0;
    this.rightScores.length = 0;
  }
}
