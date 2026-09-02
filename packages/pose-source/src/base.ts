import type { Frame } from '@kine/shared';

export type FrameListener = (frame: Frame) => void;
export type ErrorListener = (error: Error) => void;

/**
 * THE SEAM.
 *
 * Everything above this interface — the movement engine, exercise definitions,
 * cue catalogue, session model, UI — is written once and shared. Everything
 * below it is platform-specific and swappable:
 *
 *   WebPoseSource     MediaPipe Tasks Vision + getUserMedia   (browser, iPhone)
 *   NativePoseSource  VisionCamera frame processor            (Android app)
 *   MockPoseSource    replays a recorded fixture              (dev, tests, demo)
 *
 * If you find yourself wanting to add a method here that only one platform can
 * implement, that is a sign the logic belongs in the engine instead.
 *
 * Note the asymmetry in where adapters live: `WebPoseSource` ships in this
 * package because it has no native build step, while `NativePoseSource` lives
 * in apps/mobile alongside the react-native-vision-camera dependency it needs.
 * The interface is the contract; adapters live where their dependencies live.
 */
export interface PoseSource {
  start(): Promise<void>;
  stop(): void;
  onFrame(cb: FrameListener): () => void;
  onError(cb: ErrorListener): () => void;
  readonly isRunning: boolean;
}

/** Minimal listener bookkeeping shared by every adapter. */
export abstract class BasePoseSource implements PoseSource {
  private frameListeners = new Set<FrameListener>();
  private errorListeners = new Set<ErrorListener>();
  protected running = false;

  abstract start(): Promise<void>;
  abstract stop(): void;

  get isRunning(): boolean {
    return this.running;
  }

  onFrame(cb: FrameListener): () => void {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  protected emitFrame(frame: Frame): void {
    for (const cb of this.frameListeners) cb(frame);
  }

  protected emitError(error: Error): void {
    if (this.errorListeners.size === 0) {
      console.error('[PoseSource] unhandled error', error);
      return;
    }
    for (const cb of this.errorListeners) cb(error);
  }
}
