import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    pool: 'threads',
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
  },
  resolve: {
    alias: [
      {
        find: '@gorenku/studio-engines',
        replacement: new URL('../engines/src/index.ts', import.meta.url).pathname,
      },
    ],
  },
});
