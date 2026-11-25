import { describe, expect, it } from 'vitest';
import {
  ExerciseSession,
  computeSignal,
  generateSeatedArmSequence,
  skeletonSeatedFront,
  mulberry32,
  type RepSpec,
  type SeatedArmMotion,
} from '@kine/movement-engine';
import { getExercise } from '@kine/exercise-library';
import type { EngineEvent, Frame } from '@kine/shared';

const ABDUCTION = getExercise('seated_shoulder_abduction');
const OVERHEAD = getExercise('seated_overhead_reach');
const ELBOW = getExercise('seated_elbow_flexion');

function reps(count: number, peakDeg: number, durationMs = 3500, holdMs = 600): RepSpec[] {
  return Array.from({ length: count }, () => ({ peakDeg, durationMs, holdMs }));
}

function run(
  def: typeof ABDUCTION,
  motion: SeatedArmMotion,
  spec: RepSpec[],
  extra: { noise?: number; seed?: number; torsoTiltDeg?: number; leadInMs?: number } = {},
) {
  const { frames } = generateSeatedArmSequence({
    motion,
    reps: spec,
    noise: extra.noise ?? 0.004,
    seed: extra.seed ?? 3,
    ...(extra.torsoTiltDeg !== undefined ? { torsoTiltDeg: extra.torsoTiltDeg } : {}),
    ...(extra.leadInMs !== undefined ? { leadInMs: extra.leadInMs } : {}),
  });
  const session = new ExerciseSession(def);
  const events: EngineEvent[] = [];
  for (const f of frames) events.push(...session.push(f));
  return { session, events, count: events.filter((e) => e.kind === 'rep').length };
}

describe('seated upper-body exercises never need the legs', () => {
  it.each([ABDUCTION, OVERHEAD, ELBOW])('$id requires no leg landmark', (def) => {
    for (const leg of ['knee', 'ankle', 'heel', 'foot'] as const) {
      expect(def.requiredParts).not.toContain(leg);
    }
    expect(def.camera.view).toBe('front');
  });
});

describe('the synthetic seated patient measures what it claims', () => {
  const frame = (motion: SeatedArmMotion, deg: number): Frame => ({
    t: 0,
    landmarks: skeletonSeatedFront(motion, deg, mulberry32(1)),
  });

  it('reads shoulder height as roughly 90 degrees at the shoulder', () => {
    const a = computeSignal(frame('shoulder', 90), ABDUCTION.signal, 'left')!;
    expect(a).toBeGreaterThan(85);
    expect(a).toBeLessThan(100);
  });

  it('reads hanging arms as a small shoulder angle', () => {
    expect(computeSignal(frame('shoulder', 5), ABDUCTION.signal, 'left')!).toBeLessThan(20);
  });

  it('reads a front-view elbow as straight below 90 degrees of flexion and closed above it', () => {
    expect(computeSignal(frame('elbow', 0), ELBOW.signal, 'left')!).toBeGreaterThan(160);
    expect(computeSignal(frame('elbow', 140), ELBOW.signal, 'left')!).toBeLessThan(40);
  });
});

describe('side arm raises (seated_shoulder_abduction)', () => {
  it('counts ten raises to shoulder height', () => {
    expect(run(ABDUCTION, 'shoulder', reps(10, 90)).count).toBe(10);
  });

  it('counts raises that stop a little short of shoulder height', () => {
    expect(run(ABDUCTION, 'shoulder', reps(6, 78), { seed: 8 }).count).toBe(6);
  });

  it('does not count small half-movements', () => {
    expect(run(ABDUCTION, 'shoulder', reps(6, 45)).count).toBe(0);
  });

  it('counts nothing while the patient sits still', () => {
    const r = run(ABDUCTION, 'shoulder', [], { leadInMs: 12000, noise: 0.006 });
    expect(r.count).toBe(0);
  });

  it('reminds the patient to sit tall when they lean sideways', () => {
    const r = run(ABDUCTION, 'shoulder', reps(4, 90), { torsoTiltDeg: 24 });
    expect(r.events.some((e) => e.kind === 'formCue' && e.ruleId === 'torso_lean')).toBe(true);
  });

  it('still counts every raise when the patient leans', () => {
    expect(run(ABDUCTION, 'shoulder', reps(5, 90), { torsoTiltDeg: 24 }).count).toBe(5);
  });

  it('stays quiet about posture when the patient sits upright', () => {
    const r = run(ABDUCTION, 'shoulder', reps(6, 90));
    expect(r.events.filter((e) => e.kind === 'formCue')).toHaveLength(0);
  });
});

describe('overhead reach (seated_overhead_reach)', () => {
  it('counts ten full reaches overhead', () => {
    expect(run(OVERHEAD, 'shoulder', reps(10, 165, 4500)).count).toBe(10);
  });

  it('does not count a raise that only reaches shoulder height', () => {
    expect(run(OVERHEAD, 'shoulder', reps(6, 90)).count).toBe(0);
  });
});

describe('elbow bends (seated_elbow_flexion)', () => {
  it('counts ten full elbow bends', () => {
    expect(run(ELBOW, 'elbow', reps(10, 140, 3000, 400)).count).toBe(10);
  });

  it('counts bends with noisier tracking', () => {
    expect(run(ELBOW, 'elbow', reps(8, 140, 3000, 400), { noise: 0.006, seed: 21 }).count).toBe(8);
  });

  it('does not count a bend that never brings the hand above the elbow', () => {
    expect(run(ELBOW, 'elbow', reps(6, 60, 3000, 400)).count).toBe(0);
  });

  it('counts nothing while the arms rest', () => {
    expect(run(ELBOW, 'elbow', [], { leadInMs: 12000, noise: 0.006 }).count).toBe(0);
  });
});
