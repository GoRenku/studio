import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { prepareStudioE2eRuntime } from './e2e/fixtures/studio-e2e-runtime';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const runtime = prepareStudioE2eRuntime({ packageRoot });

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: path.join(runtime.runRoot, 'playwright-results'),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: path.join(runtime.runRoot, 'playwright-report') }]]
    : [['line']],
  use: {
    baseURL: runtime.serverUrl,
    viewport: { width: 1440, height: 1000 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-regression',
      testIgnore: [/.*\.smoke\.spec\.ts/, /.*\.compat\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-compatibility',
      testMatch: /.*\.compat\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
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
      HOME: runtime.homeDir,
      RENKU_MOVIE_STUDIO_ROOT: runtime.storageRoot,
      RENKU_STUDIO_E2E: '1',
    },
  },
});

if (!fs.existsSync(runtime.storageRoot)) {
  throw new Error(`Expected Studio E2E storage root to exist: ${runtime.storageRoot}`);
}
