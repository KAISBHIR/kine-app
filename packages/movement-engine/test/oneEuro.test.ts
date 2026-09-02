import { describe, expect, it } from 'vitest';
import { OneEuroFilter, mulberry32 } from '@kine/movement-engine';

function variance(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
}

describe('OneEuroFilter', () => {
  it('substantially reduces jitter on a stationary signal', () => {
    const rnd = mulberry32(42);
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const filtered: number[] = [];

    for (let i = 0; i < 200; i++) {
      const x = 0.5 + (rnd() - 0.5) * 0.02;
      raw.push(x);
      filtered.push(f.filter(x, i / 30));
    }

    // Ignore the warm-up while the filter seeds itself.
    expect(variance(filtered.slice(30))).toBeLessThan(variance(raw.slice(30)) * 0.25);
  });

  it('converges on a step change instead of lagging forever', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) f.filter(0, i / 30);
    let y = 0;
    for (let i = 30; i < 90; i++) y = f.filter(1, i / 30);
    expect(y).toBeGreaterThan(0.95);
  });

  it('tracks a fast ramp without excessive lag', () => {
    const f = new OneEuroFilter();
    let y = 0;
    for (let i = 0; i < 60; i++) y = f.filter(i * 2, i / 30);
    // True value at the last sample is 118.
    expect(y).toBeGreaterThan(110);
  });

  it('survives duplicate and out-of-order timestamps', () => {
    const f = new OneEuroFilter();
    f.filter(1, 0);
    const a = f.filter(2, 0);
    const b = f.filter(3, -1);
    expect(Number.isFinite(a)).toBe(true);
    expect(Number.isFinite(b)).toBe(true);
  });

  it('passes the first sample through untouched', () => {
    expect(new OneEuroFilter().filter(0.42, 0)).toBe(0.42);
  });
});
