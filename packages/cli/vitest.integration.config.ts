import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: [
      new URL('../../scripts/vitest-renku-tmpdir-cleanup.mjs', import.meta.url)
        .pathname,
    ],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: [
      {
        find: '@gorenku/studio-core/server',
        replacement: new URL('../core/src/server/index.ts', import.meta.url).pathname,
      },
      {
        find: '@gorenku/studio-core/client',
        replacement: new URL('../core/src/client/index.ts', import.meta.url).pathname,
      },
      {
        find: '@gorenku/studio-engines',
        replacement: new URL('../engines/src/index.ts', import.meta.url).pathname,
      },
    ],
  },
});
