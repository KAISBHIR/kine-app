import { describe, expect, it } from 'vitest';
import { angleDeg, segmentTiltFromVerticalDeg } from '@kine/movement-engine';
import { jointAngle } from '../src/signal.js';
import { mulberry32, skeletonForKneeAngle } from './fixtures/synth.js';

describe('angleDeg', () => {
  it('measures a right angle at the vertex', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(90, 6);
  });

  it('measures a straight limb as 180 degrees', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180, 6);
  });

  it('measures a fully folded limb as 0 degrees', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0, 6);
  });

  it('returns 0 rather than NaN for coincident points', () => {
    expect(angleDeg({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe('segmentTiltFromVerticalDeg', () => {
  it('is 0 for a vertical segment', () => {
    expect(segmentTiltFromVerticalDeg({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 })).toBeCloseTo(0, 6);
  });

  it('is 90 for a horizontal segment', () => {
    expect(segmentTiltFromVerticalDeg({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 })).toBeCloseTo(90, 6);
  });

  it('is 45 for a diagonal, regardless of direction', () => {
    expect(segmentTiltFromVerticalDeg({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45, 6);
    expect(segmentTiltFromVerticalDeg({ x: 1, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(45, 6);
  });
});

describe('synthetic skeleton geometry', () => {
  const rnd = mulberry32(7);

  it.each([60, 90, 120, 150, 165, 179])('reproduces a knee angle of %i degrees', (deg) => {
    const frame = { t: 0, landmarks: skeletonForKneeAngle(deg, rnd) };
    const measured = jointAngle(frame, 'knee', 'left');
    expect(measured).not.toBeNull();
    expect(measured as number).toBeCloseTo(deg, 4);
  });

  it('places the near leg at higher visibility than the far leg', () => {
    const frame = { t: 0, landmarks: skeletonForKneeAngle(120, rnd) };
    expect(frame.landmarks[25]!.visibility).toBeGreaterThan(frame.landmarks[26]!.visibility);
  });
});
