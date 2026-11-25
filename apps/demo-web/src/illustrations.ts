/**
 * Line pictograms for each exercise: the start position in a faint stroke,
 * the movement in the brand colour. Purely presentational — colours come from
 * CSS (.ill-*), so they follow the theme.
 */

const HEAD = (x: number, y: number) => `<circle class="ill-body" cx="${x}" cy="${y}" r="5"/>`;
const LINE = (cls: string, pts: Array<[number, number]>) =>
  `<polyline class="${cls}" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;

/** Seated, facing the viewer: head, trunk, shoulders, hips, thighs, shins. */
const SEATED_FRONT = [
  HEAD(32, 12),
  LINE('ill-body', [[32, 18], [32, 37]]),
  LINE('ill-body', [[25, 21], [39, 21]]),
  LINE('ill-body', [[27, 37], [37, 37]]),
  LINE('ill-body', [[27, 37], [25, 46], [25, 57]]),
  LINE('ill-body', [[37, 37], [39, 46], [39, 57]]),
  LINE('ill-ground', [[16, 41], [48, 41]]),
].join('');

/** Seated, side view, facing right. */
const SEATED_SIDE = [
  HEAD(20, 11),
  LINE('ill-body', [[20, 17], [20, 36], [34, 36]]),
  LINE('ill-body', [[20, 22], [26, 31], [32, 31]]),
  LINE('ill-ground', [[12, 40], [30, 40]]),
  LINE('ill-ground', [[14, 40], [14, 58]]),
  LINE('ill-ground', [[12, 22], [12, 40]]),
].join('');

const STANDING_FRONT_TRUNK = [
  HEAD(32, 9),
  LINE('ill-body', [[32, 15], [32, 33]]),
  LINE('ill-body', [[25, 18], [39, 18]]),
  LINE('ill-body', [[25, 18], [23, 32]]),
  LINE('ill-body', [[39, 18], [41, 32]]),
  LINE('ill-body', [[28, 33], [36, 33]]),
].join('');

const SVG: Record<string, string> = {
  seated_shoulder_abduction:
    SEATED_FRONT +
    LINE('ill-ghost', [[25, 21], [23, 36]]) +
    LINE('ill-ghost', [[39, 21], [41, 36]]) +
    LINE('ill-move', [[25, 21], [9, 21]]) +
    LINE('ill-move', [[39, 21], [55, 21]]),

  seated_overhead_reach:
    SEATED_FRONT +
    LINE('ill-ghost', [[25, 21], [23, 36]]) +
    LINE('ill-ghost', [[39, 21], [41, 36]]) +
    LINE('ill-move', [[25, 21], [21, 4]]) +
    LINE('ill-move', [[39, 21], [43, 4]]),

  seated_elbow_flexion:
    SEATED_FRONT +
    LINE('ill-body', [[25, 21], [23, 30]]) +
    LINE('ill-body', [[39, 21], [41, 30]]) +
    LINE('ill-ghost', [[23, 30], [23, 39]]) +
    LINE('ill-ghost', [[41, 30], [41, 39]]) +
    LINE('ill-move', [[23, 30], [27, 22]]) +
    LINE('ill-move', [[41, 30], [37, 22]]),

  seated_knee_extension:
    SEATED_SIDE +
    LINE('ill-ghost', [[34, 36], [34, 54]]) +
    LINE('ill-move', [[34, 36], [52, 31]]),

  sit_to_stand:
    LINE('ill-ground', [[8, 40], [24, 40]]) +
    LINE('ill-ground', [[10, 40], [10, 58]]) +
    LINE('ill-ground', [[8, 22], [8, 40]]) +
    LINE('ill-ghost', [[16, 38], [28, 38], [28, 56]]) +
    HEAD(38, 7) +
    LINE('ill-move', [[38, 13], [38, 36], [38, 57]]) +
    LINE('ill-body', [[38, 18], [44, 28]]),

  straight_leg_raise:
    HEAD(9, 44) +
    LINE('ill-body', [[14, 47], [34, 47]]) +
    LINE('ill-ghost', [[34, 47], [56, 47]]) +
    LINE('ill-move', [[34, 47], [53, 35]]) +
    LINE('ill-ground', [[4, 52], [60, 52]]),

  heel_raises:
    HEAD(32, 8) +
    LINE('ill-body', [[32, 14], [32, 34], [32, 52]]) +
    LINE('ill-body', [[32, 19], [36, 32]]) +
    LINE('ill-ghost', [[26, 57], [38, 57]]) +
    LINE('ill-move', [[32, 52], [38, 55]]) +
    LINE('ill-move', [[46, 54], [46, 42]]) +
    LINE('ill-move', [[42, 46], [46, 42], [50, 46]]) +
    LINE('ill-ground', [[18, 58], [54, 58]]),

  standing_hip_abduction:
    STANDING_FRONT_TRUNK +
    LINE('ill-body', [[28, 33], [28, 57]]) +
    LINE('ill-ghost', [[36, 33], [36, 57]]) +
    LINE('ill-move', [[36, 33], [47, 55]]) +
    LINE('ill-ground', [[16, 58], [52, 58]]),
};

export function exerciseIllustration(exerciseId: string): string {
  const body = SVG[exerciseId] ?? SEATED_FRONT;
  return `<svg class="ill" viewBox="0 0 64 64" fill="none" aria-hidden="true">${body}</svg>`;
}
