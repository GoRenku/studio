import { defineConfig } from 'vitest/config';

const alias = [
  {
    find: '@gorenku/studio-engines',
    replacement: new URL('../engines/src/index.ts', import.meta.url).pathname,
  },
];

// Same split as vitest.config.ts: vi.mock needs a fresh module registry per
// file, everything else shares one worker context so template fixtures build
// once per run. A vi.mock call in a shared-context file fails loudly; add the
// file here.
const moduleMockedTests = [
  'tests/integration/media-generation-dependency-draft-estimates.test.ts',
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
          exclude: moduleMockedTests,
          isolate: false,
        },
        resolve: { alias },
      },
      {
        test: {
          ...sharedProjectSettings,
          name: 'module-mocked',
          include: moduleMockedTests,
          isolate: true,
        },
        resolve: { alias },
      },
    ],
  },
  resolve: {
    alias,
  },
});
