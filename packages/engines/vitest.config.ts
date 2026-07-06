import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: [
      new URL('../../scripts/vitest-renku-tmpdir-cleanup.mjs', import.meta.url)
        .pathname,
    ],
    include: [
      'src/**/*.test.ts',
      'tests/schemas/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/e2e/**',
      'src/sdk/unified/ffmpeg-image-splitter.test.ts',
      'src/sdk/replicate/retry.test.ts',
      'src/model-catalog.test.ts',
    ],
  },
});
