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
 * Records landmark streams to a JSON file.
 *
 * This is the Day 1 deliverable that makes every later day cheaper: recorded
 * fixtures let the movement engine be developed and regression-tested against
 * real human movement with no camera, no phone and no volunteer in the room.
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
    // Round to 4 decimals: sub-0.01% of frame width is well below the model's
    // own precision, and it makes the JSON roughly half the size.
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

  stop(note = ''): LandmarkFixture {
    this.recording = false;
    const first = this.frames[0];
    const last = this.frames[this.frames.length - 1];
    const spanMs = first && last && last.t > first.t ? last.t - first.t : 0;

    return {
      meta: {
        exerciseId: this.exerciseId,
        note,
        recordedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        measuredFps: spanMs ? Math.round((this.frames.length / spanMs) * 1000 * 10) / 10 : 0,
        frameCount: this.frames.length,
      },
      frames: this.frames,
    };
  }

  static download(fixture: LandmarkFixture, filename?: string): void {
    const name =
      filename ??
      `${fixture.meta.exerciseId || 'pose'}_${new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19)}.json`;

    const blob = new Blob([JSON.stringify(fixture)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}
