import type { Frame } from '@kine/shared';

export interface FixtureMeta {
  exerciseId: string;
  note: string;
  recordedAt: string;
  userAgent: string;
  /** Measured, not requested — tells you what the device actually delivered. */
  measuredFps: number;
  frameCount: number;
}

export interface LandmarkFixture {
  meta: FixtureMeta;
  frames: Frame[];
}

/**
 * Records landmark streams for replay and regression testing.
 *
 * This is what makes every day after Day 1 cheaper: recorded fixtures let the
 * movement engine be developed and regression-tested against real human
 * movement with no camera, no phone, and no volunteer in the room.
 *
 * Note what it captures: landmarks only. No video is written, which is both the
 * product's privacy position and the reason these files are safe to commit.
 */
export class LandmarkRecorder {
  private frames: Frame[] = [];
  private recording = false;
  private exerciseId = '';

  get isRecording(): boolean {
    return this.recording;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  start(exerciseId: string): void {
    this.frames = [];
    this.exerciseId = exerciseId;
    this.recording = true;
  }

  push(frame: Frame): void {
    if (!this.recording) return;
    // Round to 4 decimals: far below the model's own precision, and it roughly
    // halves the JSON size.
    this.frames.push({
      t: Math.round(frame.t),
      landmarks: frame.landmarks.map((l) => ({
        x: round4(l.x),
        y: round4(l.y),
        z: round4(l.z),
        visibility: round4(l.visibility),
      })),
    });
  }

  stop(note = '', userAgent = ''): LandmarkFixture {
    this.recording = false;
    const first = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    const spanMs = first && last && last.t > first.t ? last.t - first.t : 0;

    return {
      meta: {
        exerciseId: this.exerciseId,
        note,
        recordedAt: new Date().toISOString(),
        userAgent,
        measuredFps: spanMs ? Math.round((this.frames.length / spanMs) * 1000 * 10) / 10 : 0,
        frameCount: this.frames.length,
      },
      frames: this.frames,
    };
  }
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
