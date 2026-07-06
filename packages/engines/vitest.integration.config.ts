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
});
