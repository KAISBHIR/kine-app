import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@kine/shared': r('./packages/shared/src/index.ts'),
      '@kine/movement-engine': r('./packages/movement-engine/src/index.ts'),
      '@kine/exercise-library': r('./packages/exercise-library/src/index.ts'),
      '@kine/pose-source': r('./packages/pose-source/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/test/**/*.test.ts'],
    environment: 'node',
  },
});
