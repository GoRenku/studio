import { defineConfig } from 'vitest/config';
import { loadProviderEnvFiles } from './src/provider-env-files.js';

loadProviderEnvFiles();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    setupFiles: ['./tests/e2e/setup.ts'],
    testTimeout: 180000,
  },
});
