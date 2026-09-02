/**
 * Vendors the MediaPipe pose model into public/models/.
 *
 * The demo must not depend on a third-party CDN at pitch time. Run this once
 * after cloning: `npm run fetch:model -w @kine/demo-web`.
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'models');

const MODELS = [
  {
    name: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
];

await mkdir(OUT_DIR, { recursive: true });

for (const model of MODELS) {
  const dest = join(OUT_DIR, model.name);
  try {
    const s = await stat(dest);
    if (s.size > 0) {
      console.log(`✓ ${model.name} already present (${(s.size / 1e6).toFixed(1)} MB)`);
      continue;
    }
  } catch {
    // not downloaded yet
  }

  console.log(`↓ fetching ${model.name} ...`);
  const res = await fetch(model.url);
  if (!res.ok) {
    console.error(`✗ ${model.name}: HTTP ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`✓ ${model.name} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
