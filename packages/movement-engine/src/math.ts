export interface Point2 {
  x: number;
  y: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Interior angle at vertex `b`, in degrees (0..180).
 *
 * Deliberately 2D. MediaPipe's z coordinate is a weak monocular depth estimate;
 * folding it into a clinical signal makes the number look more precise while
 * making it less stable. Camera view requirements in each exercise definition
 * exist precisely so the movement happens in the image plane.
 */
export function angleDeg(a: Point2, b: Point2, c: Point2): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return 0;

  const cos = clamp((v1x * v2x + v1y * v2y) / (n1 * n2), -1, 1);
  return Math.acos(cos) * RAD_TO_DEG;
}

/**
 * Tilt of the segment from->to away from vertical, in degrees (0..90).
 * 0 = perfectly upright, 90 = horizontal.
 *
 * Image coordinates have y increasing downward; using absolute components
 * makes the result independent of which end is "up".
 */
export function segmentTiltFromVerticalDeg(from: Point2, to: Point2): number {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(dx, dy) * RAD_TO_DEG;
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
