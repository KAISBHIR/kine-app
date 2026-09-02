import {
  jointChain,
  landmarkIndex,
  type BodyPart,
  type Frame,
  type Side,
} from '@kine/shared';
import { angleDeg, segmentTiltFromVerticalDeg, type Point2 } from './math.js';
import type { SignalSpec } from './definition.js';

export function point(frame: Frame, part: BodyPart, side: Side): Point2 | null {
  const lm = frame.landmarks[landmarkIndex(part, side)];
  return lm ? { x: lm.x, y: lm.y } : null;
}

export function jointAngle(frame: Frame, joint: BodyPart, side: Side): number | null {
  const [proximal, distal] = jointChain(joint);
  const a = point(frame, proximal, side);
  const b = point(frame, joint, side);
  const c = point(frame, distal, side);
  if (!a || !b || !c) return null;
  return angleDeg(a, b, c);
}

/** The single scalar the rep detector tracks for this exercise. */
export function computeSignal(frame: Frame, spec: SignalSpec, side: Side): number | null {
  switch (spec.type) {
    case 'jointAngle':
      return jointAngle(frame, spec.joint, side);
    case 'segmentTilt': {
      const from = point(frame, spec.from, side);
      const to = point(frame, spec.to, side);
      if (!from || !to) return null;
      return segmentTiltFromVerticalDeg(from, to);
    }
  }
}
