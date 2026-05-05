import { loadEnv } from './src/contracts/core.js';

loadEnv(import.meta.url);

export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 180000,
  },
};
