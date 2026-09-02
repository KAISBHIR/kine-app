import { describe, expect, it } from 'vitest';
import { RepMachine, type ExerciseDefinition } from '@kine/movement-engine';
import { getExercise } from '@kine/exercise-library';

const KNEE = getExercise('seated_knee_extension');

/** Drives the machine with a triangular angle profile and collects outputs. */
function run(
  def: ExerciseDefinition,
  cycles: Array<{ peak: number; durationMs: number }>,
  opts: { start?: number; restMs?: number; fps?: number } = {},
) {
  const m = new RepMachine(def);
  const start = opts.start ?? 90;
  const restMs = opts.restMs ?? 800;
  const dt = 1000 / (opts.fps ?? 30);

  let t = 0;
  let reps = 0;
  let partials = 0;
  const peaks: number[] = [];

  const step = (deg: number) => {
    const out = m.update(deg, t);
    if (out.rep) {
      reps++;
      peaks.push(out.rep.peakDeg);
    }
    if (out.partial) partials++;
    t += dt;
  };

  for (let e = 0; e < 700; e += dt) step(start);

  for (const c of cycles) {
    const half = c.durationMs / 2;
    for (let e = 0; e < half; e += dt) step(start + ((c.peak - start) * e) / half);
    for (let e = 0; e < half; e += dt) step(c.peak - ((c.peak - start) * e) / half);
    for (let e = 0; e < restMs; e += dt) step(start);
  }

  return { reps, partials, peaks };
}

describe('RepMachine', () => {
  it('counts exactly the repetitions performed', () => {
    const cycles = Array.from({ length: 10 }, () => ({ peak: 165, durationMs: 4000 }));
    expect(run(KNEE, cycles).reps).toBe(10);
  });

  it('reports the peak angle reached', () => {
    const { peaks } = run(KNEE, [{ peak: 162, durationMs: 4000 }]);
    expect(peaks[0]).toBeCloseTo(162, 0);
  });

  it('does not count a movement that never reaches the target range', () => {
    // enterDeg is 150; this tops out at 140.
    const r = run(KNEE, [{ peak: 140, durationMs: 4000 }]);
    expect(r.reps).toBe(0);
    expect(r.partials).toBe(1);
  });

  it('reports how far short a partial repetition fell', () => {
    const m = new RepMachine(KNEE);
    let t = 0;
    let shortfall: number | null = null;
    const step = (deg: number) => {
      const out = m.update(deg, t);
      if (out.partial) shortfall = out.partial.shortfallDeg;
      t += 33;
    };
    for (let i = 0; i < 20; i++) step(90);
    for (let d = 90; d <= 135; d += 3) step(d);
    for (let d = 135; d >= 90; d -= 3) step(d);
    step(90);
    // Reached 135 against an enterDeg of 150.
    expect(shortfall).toBeCloseTo(15, 0);
  });

  it('rejects a twitch that is faster than a real repetition', () => {
    // minDurationMs is 1200.
    expect(run(KNEE, [{ peak: 165, durationMs: 500 }]).reps).toBe(0);
  });

  it('rejects a bounce that never dwells in the target range', () => {
    // Barely crosses enterDeg (150) and immediately falls back, so the hold
    // requirement is never met.
    const r = run(KNEE, [{ peak: 152, durationMs: 1300 }]);
    expect(r.reps).toBe(0);
  });

  it('accumulates dwell time across dips below the threshold', () => {
    // A patient holding a position right at the target angle crosses the
    // threshold repeatedly on sensor noise alone. Their repetition must still
    // count. Regression test for a hold timer that reset on every dip.
    const m = new RepMachine(KNEE);
    let t = 0;
    let reps = 0;
    const step = (deg: number) => {
      if (m.update(deg, t).rep) reps++;
      t += 33;
    };
    for (let i = 0; i < 20; i++) step(90);
    for (let d = 90; d <= 152; d += 3) step(d);
    // Two seconds straddling the 150 degree threshold.
    for (let i = 0; i < 60; i++) step(i % 2 === 0 ? 149 : 152);
    for (let d = 152; d >= 90; d -= 3) step(d);
    for (let i = 0; i < 20; i++) step(90);
    expect(reps).toBe(1);
  });

  it('does not double count when the patient hovers at the threshold', () => {
    const m = new RepMachine(KNEE);
    let t = 0;
    let reps = 0;
    const step = (deg: number) => {
      if (m.update(deg, t).rep) reps++;
      t += 33;
    };
    for (let i = 0; i < 20; i++) step(90);
    for (let d = 90; d <= 165; d += 3) step(d);
    // Wobble around the enter threshold for two seconds.
    for (let i = 0; i < 60; i++) step(i % 2 === 0 ? 149 : 152);
    for (let d = 165; d >= 90; d -= 3) step(d);
    for (let i = 0; i < 20; i++) step(90);
    expect(reps).toBe(1);
  });

  it('abandons a repetition when tracking is interrupted mid-movement', () => {
    const m = new RepMachine(KNEE);
    let t = 0;
    let reps = 0;
    const step = (deg: number) => {
      if (m.update(deg, t).rep) reps++;
      t += 33;
    };
    for (let i = 0; i < 20; i++) step(90);
    for (let d = 90; d <= 165; d += 3) step(d);
    m.interrupt();
    for (let d = 165; d >= 90; d -= 3) step(d);
    for (let i = 0; i < 20; i++) step(90);
    expect(reps).toBe(0);
  });

  it('handles a decreasing-signal exercise symmetrically', () => {
    const slr = getExercise('straight_leg_raise');
    // Hip angle falls from 175 (lying flat) to 125 (leg raised).
    const cycles = Array.from({ length: 3 }, () => ({ peak: 125, durationMs: 5000 }));
    expect(run(slr, cycles, { start: 175 }).reps).toBe(3);
  });
});
