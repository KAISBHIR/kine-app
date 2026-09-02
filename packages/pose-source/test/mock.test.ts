import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandmarkRecorder, MockPoseSource } from '@kine/pose-source';
import { ExerciseSession, cleanReps } from '@kine/movement-engine';
import { getExercise } from '@kine/exercise-library';
import type { EngineEvent, Frame } from '@kine/shared';

const KNEE = getExercise('seated_knee_extension');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Runs a mock source to completion under fake timers. */
function drain(source: MockPoseSource, ms: number): void {
  vi.advanceTimersByTime(ms);
}

describe('MockPoseSource', () => {
  it('replays every frame of a fixture, in order', async () => {
    const { frames } = cleanReps(2, 165, 4000);
    const seen: Frame[] = [];

    const src = new MockPoseSource({ frames });
    src.onFrame((f) => seen.push(f));
    await src.start();
    drain(src, 30_000);

    expect(seen).toHaveLength(frames.length);
    expect(seen[0]!.t).toBe(frames[0]!.t);
    expect(seen.at(-1)!.t).toBe(frames.at(-1)!.t);
  });

  it('emits strictly increasing timestamps', async () => {
    const { frames } = cleanReps(2, 165, 4000);
    const ts: number[] = [];

    const src = new MockPoseSource({ frames });
    src.onFrame((f) => ts.push(f.t));
    await src.start();
    drain(src, 30_000);

    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('keeps timestamps monotonic across a loop boundary', async () => {
    // The engine relies on time never going backwards. A naive loop that
    // restarts the fixture would send it back to zero and strand the rep
    // detector mid-repetition.
    const { frames } = cleanReps(1, 165, 4000);
    const ts: number[] = [];

    const src = new MockPoseSource({ frames, loop: true });
    src.onFrame((f) => ts.push(f.t));
    await src.start();
    drain(src, 15_000);
    src.stop();

    expect(ts.length).toBeGreaterThan(frames.length);
    for (let i = 1; i < ts.length; i++) {
      expect(ts[i]!).toBeGreaterThan(ts[i - 1]!);
    }
  });

  it('calls onEnd once the fixture runs out', async () => {
    const onEnd = vi.fn();
    const { frames } = cleanReps(1, 165, 4000);

    const src = new MockPoseSource({ frames, onEnd });
    await src.start();
    drain(src, 20_000);

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(src.isRunning).toBe(false);
  });

  it('honours the speed multiplier', async () => {
    const { frames } = cleanReps(2, 165, 4000);
    const fast: Frame[] = [];

    const src = new MockPoseSource({ frames, speed: 4 });
    src.onFrame((f) => fast.push(f));
    await src.start();
    // A quarter of the real duration is enough at 4x.
    drain(src, 4_000);

    expect(fast).toHaveLength(frames.length);
  });

  it('stops emitting after stop()', async () => {
    const { frames } = cleanReps(3, 165, 4000);
    let count = 0;

    const src = new MockPoseSource({ frames });
    src.onFrame(() => count++);
    await src.start();
    drain(src, 2_000);

    const atStop = count;
    src.stop();
    drain(src, 10_000);

    expect(count).toBe(atStop);
    expect(count).toBeLessThan(frames.length);
  });

  it('refuses an empty fixture', async () => {
    await expect(new MockPoseSource({ frames: [] }).start()).rejects.toThrow(/at least one frame/);
  });

  it('drives the movement engine to the same result as a direct feed', async () => {
    const { frames } = cleanReps(10, 165, 4000, { noise: 0.004, seed: 3 });

    const direct = new ExerciseSession(KNEE);
    for (const f of frames) direct.push(f);

    const viaMock = new ExerciseSession(KNEE);
    const events: EngineEvent[] = [];
    const src = new MockPoseSource({ frames });
    src.onFrame((f) => events.push(...viaMock.push(f)));
    await src.start();
    drain(src, 60_000);

    expect(events.filter((e) => e.kind === 'rep')).toHaveLength(10);
    expect(viaMock.summary()).toEqual(direct.summary());
  });
});

describe('LandmarkRecorder', () => {
  it('round-trips a recording back through the mock source', async () => {
    const { frames } = cleanReps(3, 165, 4000, { noise: 0.004, seed: 8 });

    const rec = new LandmarkRecorder();
    rec.start('seated_knee_extension');
    for (const f of frames) rec.push(f);
    const fixture = rec.stop('bench round-trip', 'vitest');

    expect(fixture.meta.exerciseId).toBe('seated_knee_extension');
    expect(fixture.meta.frameCount).toBe(frames.length);
    expect(fixture.meta.measuredFps).toBeGreaterThan(25);
    expect(fixture.meta.measuredFps).toBeLessThan(35);

    const session = new ExerciseSession(KNEE);
    const src = MockPoseSource.fromFixture(fixture);
    src.onFrame((f) => session.push(f));
    await src.start();
    drain(src, 60_000);

    // Rounding to 4 decimals must not change what the engine counts.
    expect(session.summary().reps).toBe(3);
  });

  it('ignores frames pushed while not recording', () => {
    const rec = new LandmarkRecorder();
    const { frames } = cleanReps(1, 165, 4000);
    for (const f of frames) rec.push(f);
    expect(rec.frameCount).toBe(0);
  });
});
