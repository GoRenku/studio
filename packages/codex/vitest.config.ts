import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests never send usage statistics, even on a machine that opted in.
  test: { environment: 'node', env: { RENKU_TELEMETRY_DISABLED: '1' }, include: ['src/**/*.test.ts'] },
  resolve: {
    alias: [
      { find: '@gorenku/studio-core/server/project-selection', replacement: new URL('../core/src/server/project-selection/index.ts', import.meta.url).pathname },
      { find: '@gorenku/studio-core/server', replacement: new URL('../core/src/server/index.ts', import.meta.url).pathname },
      { find: '@gorenku/studio-core/client', replacement: new URL('../core/src/client/index.ts', import.meta.url).pathname },
      { find: '@gorenku/studio-diagnostics', replacement: new URL('../diagnostics/src/index.ts', import.meta.url).pathname },
    ],
  },
});
