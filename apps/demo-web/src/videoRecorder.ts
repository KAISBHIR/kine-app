/**
 * Records real camera video — ONLY when the patient has explicitly opted in.
 *
 * This is the exception to the app's default privacy posture (see README:
 * "camera data stays on the device... no video recorded, none uploaded, by
 * default"). A clinician sometimes needs to see the actual footage, not just
 * the skeleton reconstruction, so the patient can choose to attach it to a
 * session. It stays consent-gated and per-session — there is no setting that
 * makes video capture the default.
 *
 * There is no backend to upload to yet, so "sending it to the kiné" today
 * means sharing or downloading the file directly from the patient's phone
 * (Web Share API where available, e.g. straight into WhatsApp).
 */

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export class SessionVideoRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private mimeType = 'video/webm';

  get isSupported(): boolean {
    return pickSupportedMimeType() !== null;
  }

  start(stream: MediaStream): boolean {
    const mimeType = pickSupportedMimeType();
    if (!mimeType) return false;

    this.mimeType = mimeType;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, { mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    return true;
  }

  /** Resolves with the recorded clip, or null if nothing was recording. */
  stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.mimeType }) : null;
        this.chunks = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }

  discard(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
    this.chunks = [];
  }
}

export function videoFileExtension(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

/**
 * Hands the patient the clip: native share sheet on a phone (so it can go
 * straight into WhatsApp/Messages to the kiné), a plain download otherwise.
 */
export async function shareOrDownloadVideo(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Fall through to download on any other share failure.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
