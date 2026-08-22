import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { readStudioE2eRuntime } from '../../fixtures/studio-e2e-runtime';

const runtime = readStudioE2eRuntime();
const configDirectory = path.join(
  runtime.isolatedHomeDirectory,
  '.config',
  'renku'
);
const configPath = path.join(configDirectory, 'config.yaml');
const recommendedStorageRoot = path.join(
  runtime.isolatedHomeDirectory,
  'Movies',
  'Renku'
);

test.beforeEach(async () => {
  await fs.rm(configDirectory, { recursive: true, force: true });
  await fs.rm(recommendedStorageRoot, { recursive: true, force: true });
});

test('initializes the recommended Project Library and allows provider setup to be skipped', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Welcome to Renku' })).toBeVisible();
  await expect(page.getByText(recommendedStorageRoot, { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /browse|choose folder/i })).toHaveCount(0);
  await page.screenshot({
    path: path.join(runtime.runRoot, 'onboarding-project-library.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Use this Project Library' }).click();
  await expect(page.getByRole('heading', { name: 'Provider API keys' })).toBeVisible();
  await page.screenshot({
    path: path.join(runtime.runRoot, 'onboarding-provider-api-keys.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('heading', { name: 'Project Library' })).toBeVisible();

  expect(await fs.readFile(configPath, 'utf8')).toBe(
    `version: 0.1.0\nstorageRoot: ${recommendedStorageRoot}\n`
  );
  expect((await fs.stat(recommendedStorageRoot)).isDirectory()).toBe(true);
});

test('skips onboarding for a CLI-configured custom Project Library', async ({
  page,
}) => {
  await writeConfig(runtime.projectStorageRoot);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Project Library' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Renku' })).toHaveCount(0);
});

test('blocks on invalid existing config without replacing it', async ({ page }) => {
  await fs.mkdir(configDirectory, { recursive: true });
  const invalidConfig = `version: invalid\nstorageRoot: ${runtime.projectStorageRoot}\n`;
  await fs.writeFile(configPath, invalidConfig, 'utf8');

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Setup could not be loaded' })).toBeVisible();
  await expect(page.getByText('Renku config version must be "0.1.0".')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this Project Library' })).toHaveCount(0);
  expect(await fs.readFile(configPath, 'utf8')).toBe(invalidConfig);
});

async function writeConfig(storageRoot: string): Promise<void> {
  await fs.mkdir(configDirectory, { recursive: true });
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(
    configPath,
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}
