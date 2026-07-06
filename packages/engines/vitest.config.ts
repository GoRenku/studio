import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
