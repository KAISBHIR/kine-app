import type { Frame } from '@kine/shared';
import { BasePoseSource } from './base';
import type { LandmarkFixture } from './fixture';

export interface MockPoseSourceOptions {
  frames: Frame[];
  /** Restart from the beginning when the fixture ends. */
  loop?: boolean;
  /** 1 = real time, 2 = twice as fast. Useful for demoing a long session. */
  speed?: number;
  /** Called once the fixture ends (never fires when looping). */
  onEnd?: () => void;
  /** Driving tick in ms. 16 gives roughly 60Hz polling. */
  tickMs?: number;
}

/**
 * Replays a recorded or synthetic fixture as if it were a live camera.
 *
 * This is the unblock that lets the whole app be built before the native frame
 * processor works: every screen, the voice coaching, the summary, the session
 * flow — all of it runs off a fixture. Swapping in the real camera is one line
 * at the call site, because both satisfy `PoseSource`.
 *
 * It is also the demo's safety net. If the camera misbehaves in the room, a
 * fixture-driven run still shows the product working end to end.
 */
export class MockPoseSource extends BasePoseSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private cursor = 0;
  private startedAt = 0;
  /** Added to fixture timestamps so `t` stays monotonic across loops. */
  private loopOffset = 0;

  constructor(private readonly opts: MockPoseSourceOptions) {
    super();
  }

  static fromFixture(
    fixture: LandmarkFixture,
    opts: Omit<MockPoseSourceOptions, 'frames'> = {},
  ): MockPoseSource {
    return new MockPoseSource({ frames: fixture.frames, ...opts });
  }

  get progress(): number {
    return this.opts.frames.length ? this.cursor / this.opts.frames.length : 1;
  }

  start(): Promise<void> {
    if (this.running) return Promise.resolve();
    if (this.opts.frames.length === 0) {
      return Promise.reject(new Error('MockPoseSource needs at least one frame'));
    }

    this.running = true;
    this.cursor = 0;
    this.loopOffset = 0;
    this.startedAt = now();
    this.timer = setInterval(this.tick, this.opts.tickMs ?? 16);
    return Promise.resolve();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private tick = (): void => {
    if (!this.running) return;

    const frames = this.opts.frames;
    const speed = this.opts.speed ?? 1;
    const base = frames[0]!.t;
    const elapsed = (now() - this.startedAt) * speed;

    // Emit every frame whose timestamp has come due. Catching up in a batch
    // rather than one per tick keeps playback honest on a slow device.
    while (this.cursor < frames.length) {
      const f = frames[this.cursor]!;
      if (f.t - base > elapsed) break;
      this.cursor++;
      this.emitFrame({ t: f.t + this.loopOffset, landmarks: f.landmarks });
    }

    if (this.cursor < frames.length) return;

    if (this.opts.loop) {
      const span = frames[frames.length - 1]!.t - base;
      this.loopOffset += span + 33;
      this.cursor = 0;
      this.startedAt = now();
    } else {
      this.stop();
      this.opts.onEnd?.();
    }
  };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
