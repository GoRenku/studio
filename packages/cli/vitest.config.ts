import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
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
    ],
  },
});
