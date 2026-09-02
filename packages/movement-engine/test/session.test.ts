import { describe, expect, it } from 'vitest';
import {
  ExerciseSession,
  cleanReps,
  generateKneeExtensionSequence,
} from '@kine/movement-engine';
import { getExercise } from '@kine/exercise-library';
import type { EngineEvent } from '@kine/shared';

const KNEE = getExercise('seated_knee_extension');

function play(frames: { t: number; landmarks: unknown[] }[], session: ExerciseSession) {
  const events: EngineEvent[] = [];
  for (const f of frames) events.push(...session.push(f as never));
  return events;
}

describe('ExerciseSession end to end', () => {
  it('counts ten clean repetitions from noisy landmarks', () => {
    const { frames } = cleanReps(10, 165, 4000, { noise: 0.004, seed: 3 });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);

    expect(events.filter((e) => e.kind === 'rep')).toHaveLength(10);
    expect(s.summary().reps).toBe(10);
  });

  it('numbers repetitions consecutively from one', () => {
    const { frames } = cleanReps(5, 165, 4000, { noise: 0.004, seed: 5 });
    const s = new ExerciseSession(KNEE);
    const reps = play(frames, s).filter((e) => e.kind === 'rep');
    expect(reps.map((r) => (r as { index: number }).index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('reports no repetitions when the patient sits still', () => {
    const { frames } = generateKneeExtensionSequence({
      reps: [],
      leadInMs: 12000,
      noise: 0.006,
      seed: 11,
    });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);
    expect(events.filter((e) => e.kind === 'rep')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'partialRep')).toHaveLength(0);
  });

  it('locks onto the more visible side', () => {
    const { frames } = cleanReps(2, 165, 4000, { noise: 0.004, seed: 9 });
    const s = new ExerciseSession(KNEE);
    play(frames, s);
    expect(s.side).toBe('left');
  });

  it('produces a summary a clinician could read', () => {
    const { frames } = cleanReps(8, 165, 4000, { noise: 0.004, seed: 13 });
    const s = new ExerciseSession(KNEE);
    play(frames, s);
    const sum = s.summary();

    expect(sum.exerciseId).toBe('seated_knee_extension');
    expect(sum.reps).toBe(8);
    expect(sum.bestPeakDeg).toBeGreaterThan(158);
    expect(sum.bestPeakDeg).toBeLessThan(172);
    expect(sum.quality).toBeGreaterThan(70);
    expect(sum.trackingQuality).toBeGreaterThan(0.98);
  });

  it('scores a shallow repetition lower than a full one', () => {
    const full = new ExerciseSession(KNEE);
    play(cleanReps(5, 165, 4000, { noise: 0.002, seed: 17 }).frames, full);

    const shallow = new ExerciseSession(KNEE);
    play(cleanReps(5, 152, 4000, { noise: 0.002, seed: 17 }).frames, shallow);

    const a = full.summary().quality;
    const b = shallow.summary().quality;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a as number).toBeGreaterThan(b as number);
  });

  it('stops counting while the leg is not visible, and says so', () => {
    const { frames } = generateKneeExtensionSequence({
      reps: Array.from({ length: 10 }, () => ({
        peakDeg: 165,
        durationMs: 4000,
        holdMs: 700,
      })),
      noise: 0.004,
      seed: 23,
      dropouts: [[15100, 24700]],
    });

    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);
    const vis = events.filter((e) => e.kind === 'visibility') as Array<{ ok: boolean }>;

    expect(vis.some((v) => !v.ok)).toBe(true);
    expect(vis.some((v) => v.ok)).toBe(true);

    const reps = events.filter((e) => e.kind === 'rep').length;
    expect(reps).toBeGreaterThanOrEqual(7);
    expect(reps).toBeLessThan(10);
  });

  it('names the body parts it cannot see', () => {
    const { frames } = generateKneeExtensionSequence({
      reps: [{ peakDeg: 165, durationMs: 4000, holdMs: 700 }],
      noise: 0.003,
      seed: 29,
      dropouts: [[1500, 4000]],
    });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);
    const lost = events.find((e) => e.kind === 'visibility' && !e.ok) as
      | { missing: string[] }
      | undefined;

    expect(lost).toBeDefined();
    expect(lost!.missing).toEqual(expect.arrayContaining(['hip', 'knee', 'ankle']));
  });

  it('reports partial repetitions instead of counting them', () => {
    const { frames } = cleanReps(4, 138, 4000, { noise: 0.003, seed: 31 });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);

    expect(events.filter((e) => e.kind === 'rep')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'partialRep').length).toBeGreaterThanOrEqual(3);
    expect(s.summary().reps).toBe(0);
  });

  it('fires the torso cue when the patient leans forward', () => {
    const { frames } = cleanReps(6, 165, 4000, {
      noise: 0.003,
      seed: 37,
      torsoTiltDeg: 32,
    });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);
    const cues = events.filter(
      (e) => e.kind === 'formCue' && e.ruleId === 'torso_lean',
    );
    expect(cues.length).toBeGreaterThan(0);
    expect(s.summary().cues['torso_lean']).toBeGreaterThan(0);
  });

  it('stays quiet when the patient sits upright', () => {
    const { frames } = cleanReps(6, 165, 4000, { noise: 0.003, seed: 41 });
    const s = new ExerciseSession(KNEE);
    const events = play(frames, s);
    expect(events.filter((e) => e.kind === 'formCue')).toHaveLength(0);
  });

  it('respects the cooldown instead of repeating a cue every frame', () => {
    const { frames } = cleanReps(6, 165, 4000, {
      noise: 0.003,
      seed: 43,
      torsoTiltDeg: 40,
    });
    const s = new ExerciseSession(KNEE);
    const cues = play(frames, s).filter((e) => e.kind === 'formCue');
    // Six reps over roughly 29 seconds with a 6 second cooldown.
    expect(cues.length).toBeLessThanOrEqual(6);
  });

  it('can be reset and reused', () => {
    const s = new ExerciseSession(KNEE);
    play(cleanReps(3, 165, 4000, { noise: 0.003, seed: 47 }).frames, s);
    expect(s.summary().reps).toBe(3);
    s.reset();
    expect(s.summary().reps).toBe(0);
    play(cleanReps(2, 165, 4000, { noise: 0.003, seed: 47 }).frames, s);
    expect(s.summary().reps).toBe(2);
  });
});
