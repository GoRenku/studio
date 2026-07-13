import { defineConfig } from 'vitest/config';

const alias = [
  {
    find: '@gorenku/studio-engines',
    replacement: new URL('../engines/src/index.ts', import.meta.url).pathname,
  },
];

const sharedProjectSettings = {
  globals: true,
  environment: 'node' as const,
  pool: 'threads',
  fileParallelism: false,
  minWorkers: 1,
  maxWorkers: 1,
};

export default defineConfig({
  test: {
    globalSetup: [
      new URL('../../scripts/vitest-renku-tmpdir-cleanup.mjs', import.meta.url)
        .pathname,
    ],
    projects: [
      {
        test: {
          ...sharedProjectSettings,
          name: 'shared-context',
          include: ['tests/integration/**/*.test.ts'],
          isolate: false,
        },
        resolve: { alias },
      },
    ],
  },
  resolve: {
    alias,
  },
});
