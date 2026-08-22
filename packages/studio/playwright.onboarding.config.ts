import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { prepareStudioE2eRuntime } from './e2e/fixtures/studio-e2e-runtime';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const runtime = prepareStudioE2eRuntime({
  packageRoot,
  initializeConfig: false,
});

export default defineConfig({
  testDir: './e2e/tests/onboarding',
  outputDir: path.join(runtime.runRoot, 'playwright-onboarding-results'),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: runtime.serverUrl,
    viewport: { width: 1440, height: 1000 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    cwd: packageRoot,
    url: `${runtime.serverUrl}/studio-api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      ...process.env,
      HOME: runtime.isolatedHomeDirectory,
      RENKU_MOVIE_STUDIO_ROOT: runtime.projectStorageRoot,
      RENKU_STUDIO_E2E_SERVER_ENABLED: '1',
    },
  },
});
