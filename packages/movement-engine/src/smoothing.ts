import { LANDMARK_COUNT, type Frame, type Landmark } from '@kine/shared';
import { DEFAULT_ONE_EURO, OneEuroFilter, type OneEuroParams } from './oneEuro';

/**
 * Applies a One Euro filter to every landmark's x and y, and a light EMA to
 * visibility (which flickers hard around the detection threshold and would
 * otherwise make the "I can't see your leg" cue stutter on and off).
 *
 * z is passed through untouched — nothing downstream consumes it.
 */
export class PoseSmoother {
  private readonly fx: OneEuroFilter[];
  private readonly fy: OneEuroFilter[];
  private readonly vis: number[];

  constructor(params: OneEuroParams = DEFAULT_ONE_EURO) {
    this.fx = Array.from({ length: LANDMARK_COUNT }, () => new OneEuroFilter(params));
    this.fy = Array.from({ length: LANDMARK_COUNT }, () => new OneEuroFilter(params));
    this.vis = new Array(LANDMARK_COUNT).fill(0);
  }

  smooth(frame: Frame): Frame {
    const tSec = frame.t / 1000;
    const out: Landmark[] = new Array(frame.landmarks.length);

    for (let i = 0; i < frame.landmarks.length; i++) {
      const lm = frame.landmarks[i];
      if (!lm) continue;

      const fx = this.fx[i];
      const fy = this.fy[i];
      const prevVis = this.vis[i] ?? 0;
      const v = prevVis + 0.35 * (lm.visibility - prevVis);
      this.vis[i] = v;

      out[i] = {
        x: fx ? fx.filter(lm.x, tSec) : lm.x,
        y: fy ? fy.filter(lm.y, tSec) : lm.y,
        z: lm.z,
        visibility: v,
      };
    }

    return { t: frame.t, landmarks: out };
  }

  reset(): void {
    for (const f of this.fx) f.reset();
    for (const f of this.fy) f.reset();
    this.vis.fill(0);
  }
}
