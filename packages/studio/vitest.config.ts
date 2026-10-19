import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Tests never send usage statistics, even on a machine that opted in.
    env: { RENKU_TELEMETRY_DISABLED: '1' },
    globalSetup: [
      path.resolve(__dirname, '../../scripts/vitest-renku-tmpdir-cleanup.mjs'),
    ],
    pool: 'threads',
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    include: ['server/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'node_modules',
      'dist',
      'server-dist',
      'src/**/*.e2e.test.ts',
      'src/**/*.e2e.test.tsx',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gorenku/studio-core/client': path.resolve(
        __dirname,
        '../core/src/client/index.ts'
      ),
      '@gorenku/studio-core/server/project-selection': path.resolve(
        __dirname,
        '../core/src/server/project-selection/index.ts'
      ),
      '@gorenku/studio-core/server': path.resolve(
        __dirname,
        '../core/src/server/index.ts'
      ),
    },
  },
});
