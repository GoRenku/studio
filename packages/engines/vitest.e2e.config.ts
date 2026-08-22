import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 180000,
  },
});
