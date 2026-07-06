import { defineConfig } from 'vitest/config';

const alias = [
  {
    find: '@gorenku/studio-engines',
    replacement: new URL('../engines/src/index.ts', import.meta.url).pathname,
  },
];

// These files replace modules with vi.mock, which requires a fresh module
// registry per file. They run in the isolated project below. Every other test
// file shares one worker context so template fixtures build once per run
// instead of once per file (each rebuild spawns a drizzle-kit process).
// A vi.mock call in a shared-context file fails loudly; add the file here.
const moduleMockedTests = [
  'src/server/media-generation/lifecycle/context-service.test.ts',
  'src/server/media-generation/lifecycle/dependency-service.test.ts',
  'src/server/media-generation/lifecycle/model-service.test.ts',
  'src/server/media-generation/lifecycle/project-session.test.ts',
  'src/server/media-generation/lifecycle/run-service.test.ts',
  'src/server/media-generation/lifecycle/scene-dialogue-audio-estimates.test.ts',
  'src/server/media-generation/lifecycle/shot-video-take-estimates.test.ts',
  'src/server/media-generation/lifecycle/shot-video-take-production-estimates.test.ts',
  'src/server/media-generation/lifecycle/spec-estimates.test.ts',
  'src/server/media-generation/lifecycle/spec-service.test.ts',
  'src/server/media-generation/dependencies/dependency-draft-specs.test.ts',
  'src/server/media-generation/dependencies/dependency-inventory.test.ts',
  'src/server/media-generation/dependencies/dependency-selectors.test.ts',
];

// Parallel workers were measured and rejected: each worker pays its own
// module-graph import and template rebuild, netting zero wall-clock gain.
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
          include: ['src/**/*.test.ts'],
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
