import type { LandmarkFixture } from '@kine/pose-source';

/**
 * Browser-only half of fixture recording. The recorder itself lives in
 * @kine/pose-source so the mobile app can record fixtures too.
 */
export function downloadFixture(fixture: LandmarkFixture, filename?: string): void {
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
