/**
 * One Euro filter (Casiez, Roussel, Vogel 2012).
 *
 * Raw pose landmarks jitter by several pixels frame to frame even when the
 * subject is perfectly still. Feeding that straight into a threshold-based rep
 * detector produces phantom repetitions. A plain low-pass fixes the jitter but
 * adds lag that makes fast movements feel unresponsive.
 *
 * One Euro adapts: heavy smoothing when the signal is slow (where jitter is
 * visible and lag is not), light smoothing when it is fast (where lag is
 * visible and jitter is not). This is the single most important preprocessing
 * step in the engine — do not remove it.
 */

class LowPass {
  private y: number | null = null;

  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }

  get value(): number | null {
    return this.y;
  }

  reset(): void {
    this.y = null;
  }
}

export interface OneEuroParams {
  /** Baseline cutoff frequency in Hz. Lower = smoother, laggier. */
  minCutoff: number;
  /** Speed coefficient. Higher = less lag on fast movement, more jitter. */
  beta: number;
  /** Cutoff for the derivative estimate. Rarely needs tuning. */
  dCutoff: number;
}

/**
 * Tuned for normalised (0..1) pose landmark coordinates at 25-30fps.
 * Revisit on Day 2 with real recordings: if reps feel laggy raise `beta`,
 * if the skeleton shimmers at rest lower `minCutoff`.
 */
export const DEFAULT_ONE_EURO: OneEuroParams = {
  minCutoff: 1.2,
  beta: 0.05,
  dCutoff: 1.0,
};

const TWO_PI = Math.PI * 2;

function alpha(cutoffHz: number, dtSec: number): number {
  const tau = 1 / (TWO_PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export class OneEuroFilter {
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private lastTimeSec: number | null = null;
  private lastRaw: number | null = null;

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  /** @param tSec timestamp in SECONDS (the engine converts from ms). */
  filter(x: number, tSec: number): number {
    if (this.lastTimeSec === null || this.lastRaw === null) {
      this.lastTimeSec = tSec;
      this.lastRaw = x;
      this.xFilter.filter(x, 1);
      return x;
    }

    let dt = tSec - this.lastTimeSec;
    // Out-of-order or duplicate timestamps happen when a frame processor
    // drops frames. Fall back to a nominal 30fps step rather than dividing
    // by zero and emitting Infinity into the rep detector.
    if (!(dt > 0) || dt > 1) dt = 1 / 30;

    const dx = (x - this.lastRaw) / dt;
    const dxHat = this.dxFilter.filter(dx, alpha(this.params.dCutoff, dt));
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(dxHat);
    const xHat = this.xFilter.filter(x, alpha(cutoff, dt));

    this.lastTimeSec = tSec;
    this.lastRaw = x;
    return xHat;
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTimeSec = null;
    this.lastRaw = null;
  }
}
