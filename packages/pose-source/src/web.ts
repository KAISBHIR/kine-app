import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { LANDMARK_COUNT, type Frame, type Landmark } from '@kine/shared';
import { BasePoseSource } from './base';

/** Keep in step with the @mediapipe/tasks-vision version in package.json. */
export const TASKS_VISION_VERSION = '1.0.1';

export const DEFAULT_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

/**
 * Vendored locally by `npm run fetch:model`. Do NOT point this at a Google URL
 * for a live demo: a pitch that depends on someone else's CDN over conference
 * wifi is a pitch that fails in front of the audience.
 */
export const DEFAULT_MODEL_PATH = '/models/pose_landmarker_lite.task';

export interface WebPoseSourceOptions {
  video: HTMLVideoElement;
  modelAssetPath?: string;
  wasmBase?: string;
  delegate?: 'GPU' | 'CPU';
  facingMode?: 'user' | 'environment';
  /** Requested capture size. The browser may return something else. */
  width?: number;
  height?: number;
}

export class WebPoseSource extends BasePoseSource {
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private startedAt = 0;
  private lastVideoTime = -1;
  private visibilityReported = false;
  private visibilityChecked = false;

  constructor(private readonly opts: WebPoseSourceOptions) {
    super();
  }

  /** True once we have determined whether the model reports real visibility. */
  get modelReportsVisibility(): boolean {
    return this.visibilityReported;
  }

  /**
   * The raw camera stream, exposed so a caller can record real video
   * alongside pose tracking (with the patient's explicit consent — see the
   * privacy architecture in the README). Returns null before start() or
   * after stop().
   */
  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: this.opts.facingMode ?? 'user',
        width: { ideal: this.opts.width ?? 1280 },
        height: { ideal: this.opts.height ?? 720 },
      },
      audio: false,
    });

    const video = this.opts.video;
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    const fileset = await FilesetResolver.forVisionTasks(
      this.opts.wasmBase ?? DEFAULT_WASM_BASE,
    );

    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: this.opts.modelAssetPath ?? DEFAULT_MODEL_PATH,
        delegate: this.opts.delegate ?? 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    this.startedAt = performance.now();
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;

    this.landmarker?.close();
    this.landmarker = null;

    const video = this.opts.video;
    if (video.srcObject) video.srcObject = null;
    this.lastVideoTime = -1;
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const video = this.opts.video;
    const landmarker = this.landmarker;
    if (!landmarker || video.readyState < 2) return;

    // MediaPipe VIDEO mode requires strictly increasing timestamps. Detecting
    // twice on the same decoded frame throws, so skip when time has not moved.
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    const t = performance.now() - this.startedAt;

    try {
      const result = landmarker.detectForVideo(video, t);
      const pose = result.landmarks?.[0];
      if (!pose || pose.length < LANDMARK_COUNT) return;
      this.emitFrame({ t, landmarks: this.toLandmarks(pose) });
    } catch (e) {
      this.emitError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  /**
   * Converts MediaPipe landmarks to the engine's format.
   *
   * The web build has historically been inconsistent about populating
   * `visibility`. When it is missing or uniformly zero we substitute an
   * in-frame presence heuristic, which still catches the failure that actually
   * matters at home: the patient's leg has left the picture. Verify which path
   * is active on Day 1 — `modelReportsVisibility` tells you.
   */
  private toLandmarks(pose: NormalizedLandmark[]): Landmark[] {
    if (!this.visibilityChecked) {
      this.visibilityChecked = true;
      this.visibilityReported = pose.some((p) => (p.visibility ?? 0) > 0.01);
      if (!this.visibilityReported) {
        console.warn(
          '[WebPoseSource] model is not reporting landmark visibility; ' +
            'falling back to in-frame presence.',
        );
      }
    }

    const out: Landmark[] = new Array(LANDMARK_COUNT);
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const p = pose[i]!;
      out[i] = {
        x: p.x,
        y: p.y,
        z: p.z ?? 0,
        visibility: this.visibilityReported
          ? (p.visibility ?? 0)
          : inFrame(p.x, p.y)
            ? 0.95
            : 0.05,
      };
    }
    return out;
  }
}

function inFrame(x: number, y: number): boolean {
  const m = 0.02;
  return x > -m && x < 1 + m && y > -m && y < 1 + m;
}
