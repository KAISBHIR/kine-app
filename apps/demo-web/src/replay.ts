import type { Frame } from '@kine/shared';
import { drawSkeleton } from './skeleton';

/**
 * Plays back a recorded landmark sequence as an animated skeleton.
 *
 * This is the default way a clinician reviews a session: it reproduces the
 * movement — timing, range, form — without a real image of the patient ever
 * having existed. It is built from the SAME frames the movement engine already
 * processes during the session, so what the clinician sees is exactly what the
 * rep counter saw, not a separate recording that could disagree with it.
 */
export class SkeletonReplay {
  private raf = 0;
  private startedAt = 0;
  private cursor = 0;
  private _playing = false;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private frames: Frame[],
  ) {}

  get playing(): boolean {
    return this._playing;
  }

  get durationMs(): number {
    if (this.frames.length < 2) return 0;
    return this.frames[this.frames.length - 1]!.t - this.frames[0]!.t;
  }

  setFrames(frames: Frame[]): void {
    this.frames = frames;
    this.cursor = 0;
    this.drawCurrent();
  }

  play(): void {
    if (this._playing || this.frames.length < 2) return;
    this._playing = true;
    this.startedAt = performance.now() - (this.frames[this.cursor]!.t - this.frames[0]!.t);
    this.tick();
  }

  pause(): void {
    this._playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  private tick = (): void => {
    if (!this._playing) return;
    const base = this.frames[0]!.t;
    const elapsed = performance.now() - this.startedAt;

    while (this.cursor < this.frames.length - 1 && this.frames[this.cursor]!.t - base <= elapsed) {
      this.cursor++;
    }

    this.drawCurrent();

    if (this.cursor >= this.frames.length - 1) {
      // Loop rather than stop dead — a still final frame reads as frozen/broken.
      this.cursor = 0;
      this.startedAt = performance.now();
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  private drawCurrent(): void {
    const frame = this.frames[this.cursor];
    if (!frame) return;
    drawSkeleton(this.ctx, frame.landmarks, {});
  }

  destroy(): void {
    this.pause();
  }
}
