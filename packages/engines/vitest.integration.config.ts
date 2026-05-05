import { loadEnv } from './src/contracts/core.js';

loadEnv(import.meta.url);

export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
};
