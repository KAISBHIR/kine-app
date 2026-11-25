import { POSE_CONNECTIONS, type Landmark } from '@kine/shared';

export interface DrawOptions {
  /** Landmark indices to emphasise — normally the limb being tracked. */
  highlight?: readonly number[];
  /** Landmarks below this visibility are not drawn at all. */
  minVisibility?: number;
  /** Set when tracking has been lost, to grey the whole skeleton out. */
  degraded?: boolean;
}

const BONE = 'rgba(255, 255, 255, 0.75)';
const BONE_HI = '#2dd4bf';
const JOINT = '#ffffff';
const FADED = '#6b7780';

/**
 * Draws the pose over the video.
 *
 * Landmarks below the visibility threshold are omitted rather than drawn in a
 * guessed position: a skeleton with a missing leg tells the patient exactly
 * what to fix, while a skeleton with a leg in the wrong place tells them the
 * app is broken.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  opts: DrawOptions = {},
): void {
  const { width: w, height: h } = ctx.canvas;
  const minVis = opts.minVisibility ?? 0.4;
  const highlight = new Set(opts.highlight ?? []);

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.globalAlpha = opts.degraded ? 0.4 : 1;

  for (const [a, b] of POSE_CONNECTIONS) {
    const p = landmarks[a];
    const q = landmarks[b];
    if (!p || !q || p.visibility < minVis || q.visibility < minVis) continue;

    const hot = highlight.has(a) && highlight.has(b);
    ctx.strokeStyle = opts.degraded ? FADED : hot ? BONE_HI : BONE;
    ctx.lineWidth = hot ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }

  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    if (!p || p.visibility < minVis) continue;
    // Face landmarks add clutter without adding information.
    if (i > 0 && i <= 10) continue;

    const hot = highlight.has(i);
    ctx.fillStyle = opts.degraded ? FADED : hot ? BONE_HI : JOINT;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, hot ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/**
 * Sizes the overlay canvas to match how the video is actually letterboxed by
 * `object-fit: contain`, so the skeleton lands on the body rather than beside
 * it. Getting this wrong is the most common reason an overlay looks "offset".
 */
export function fitOverlay(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const box = video.getBoundingClientRect();
  const scale = Math.min(box.width / vw, box.height / vh);
  const dw = vw * scale;
  const dh = vh * scale;

  canvas.width = vw;
  canvas.height = vh;
  canvas.style.width = `${dw}px`;
  canvas.style.height = `${dh}px`;
  canvas.style.left = `${(box.width - dw) / 2}px`;
  canvas.style.top = `${(box.height - dh) / 2}px`;
  canvas.style.right = 'auto';
  canvas.style.bottom = 'auto';
}
