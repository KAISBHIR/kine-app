/**
 * MediaPipe Pose (BlazePose) landmark layout — 33 points.
 *
 * This ordering is fixed by the model and is identical across the Web
 * (@mediapipe/tasks-vision) and native (MediaPipe Tasks) runtimes. Every
 * PoseSource adapter MUST emit landmarks in this order, so that the movement
 * engine never needs to know where the frames came from.
 */
export const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const LANDMARK_COUNT = 33;

export type Side = 'left' | 'right';

/** Body parts an exercise definition is allowed to reference. */
export type BodyPart =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'heel'
  | 'foot';

const PART_INDEX: Record<BodyPart, Record<Side, number>> = {
  shoulder: { left: POSE_LANDMARK.LEFT_SHOULDER, right: POSE_LANDMARK.RIGHT_SHOULDER },
  elbow: { left: POSE_LANDMARK.LEFT_ELBOW, right: POSE_LANDMARK.RIGHT_ELBOW },
  wrist: { left: POSE_LANDMARK.LEFT_WRIST, right: POSE_LANDMARK.RIGHT_WRIST },
  hip: { left: POSE_LANDMARK.LEFT_HIP, right: POSE_LANDMARK.RIGHT_HIP },
  knee: { left: POSE_LANDMARK.LEFT_KNEE, right: POSE_LANDMARK.RIGHT_KNEE },
  ankle: { left: POSE_LANDMARK.LEFT_ANKLE, right: POSE_LANDMARK.RIGHT_ANKLE },
  heel: { left: POSE_LANDMARK.LEFT_HEEL, right: POSE_LANDMARK.RIGHT_HEEL },
  foot: { left: POSE_LANDMARK.LEFT_FOOT_INDEX, right: POSE_LANDMARK.RIGHT_FOOT_INDEX },
};

export const BODY_PARTS = Object.keys(PART_INDEX) as BodyPart[];

export function isBodyPart(v: unknown): v is BodyPart {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PART_INDEX, v);
}

export function landmarkIndex(part: BodyPart, side: Side): number {
  return PART_INDEX[part][side];
}

/**
 * The three points forming a joint angle, with the named part at the vertex.
 * e.g. knee angle = hip -> knee -> ankle.
 */
const JOINT_CHAIN: Partial<Record<BodyPart, [BodyPart, BodyPart]>> = {
  knee: ['hip', 'ankle'],
  hip: ['shoulder', 'knee'],
  elbow: ['shoulder', 'wrist'],
  shoulder: ['hip', 'elbow'],
  ankle: ['knee', 'foot'],
};

export function jointChain(part: BodyPart): [BodyPart, BodyPart] {
  const chain = JOINT_CHAIN[part];
  if (!chain) throw new Error(`No joint chain defined for body part "${part}"`);
  return chain;
}

/** Bone pairs for drawing the skeleton overlay. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
];
