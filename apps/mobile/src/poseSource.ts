import { MockPoseSource, type PoseSource } from '@kine/pose-source';
import { cleanReps } from '@kine/movement-engine';

export type PoseSourceKind = 'mock' | 'camera';

export interface CreatePoseSourceOptions {
  kind: PoseSourceKind;
  /** Mock only: how many repetitions the simulated patient performs. */
  reps?: number;
  /** Mock only: 1 = real time. Raise it to shorten a demo. */
  speed?: number;
  onEnd?: () => void;
}

/**
 * Builds the pose source for a session.
 *
 * Today this always returns a mock that replays a synthetic patient, which is
 * what lets every screen, the voice coaching, the session flow and the summary
 * be built and demonstrated before the camera integration exists.
 *
 * ── Wiring the real camera (Day 2) ────────────────────────────────────────
 *
 * 1. `npx expo install react-native-vision-camera react-native-worklets-core`
 * 2. `npm run prebuild` — VisionCamera needs a dev build; it does not run in
 *    Expo Go. Android builds fine on Windows.
 * 3. Add a frame processor plugin wrapping MediaPipe's Android Pose Landmarker
 *    (`com.google.mediapipe:tasks-vision`), returning the 33 landmarks.
 * 4. Write `NativePoseSource extends BasePoseSource` that emits
 *    `{ t, landmarks }` in MediaPipe order — see `POSE_LANDMARK` in
 *    @kine/shared. Nothing above the PoseSource interface changes.
 * 5. Return it from the 'camera' branch below.
 *
 * The engine, the exercise definitions, the cues and every screen already work
 * against the mock, so step 5 is the only place this file needs to change.
 */
export function createPoseSource(opts: CreatePoseSourceOptions): PoseSource {
  if (opts.kind === 'camera') {
    throw new Error(
      'Camera pose source is not wired yet. See the instructions in ' +
        'src/poseSource.ts, or run the session with kind: "mock".',
    );
  }

  const { frames } = cleanReps(opts.reps ?? 10, 165, 4000, { noise: 0.004, seed: 7 });
  return new MockPoseSource({
    frames,
    speed: opts.speed ?? 1,
    ...(opts.onEnd ? { onEnd: opts.onEnd } : {}),
  });
}
