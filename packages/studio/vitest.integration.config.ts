import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    include: ['src/**/*.e2e.test.ts', 'src/**/*.e2e.test.tsx'],
    exclude: ['node_modules', 'dist', 'server-dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gorenku/studio-core/client': path.resolve(
        __dirname,
        '../core/src/client/index.ts'
      ),
      '@gorenku/studio-core/server': path.resolve(
        __dirname,
        '../core/src/server/index.ts'
      ),
    },
  },
});
