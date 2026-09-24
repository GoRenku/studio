import fs from 'node:fs/promises';
import path from 'node:path';
import { readProviderCredentials } from '@gorenku/studio-core/server';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('saves global provider credentials explicitly from both Studio shells', async ({
  minimalMovieProject,
  page,
  projectLibraryPage,
  studioE2eRuntime,
}) => {
  const credentialFilePath = path.join(
    studioE2eRuntime.isolatedHomeDirectory,
    '.config',
    'renku',
    '.env'
  );

  await projectLibraryPage.goto();
  await page.goto('/?settings=provider-credentials');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/$/);

  const openSettings = page.getByRole('button', { name: 'Open Settings' });
  await expect(openSettings).toBeVisible();
  await openSettings.click();

  await expect(dialog.getByText('Fal.ai', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Replicate', { exact: true })).toBeVisible();
  await expect(dialog.getByText('WaveSpeed', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ElevenLabs', { exact: true })).toBeVisible();
  await expect(dialog.getByText('World Labs', { exact: true })).toBeVisible();
  const falKeyInput = dialog.getByLabel('Fal.ai', { exact: true });
  await falKeyInput.fill('fake-fal-key-for-e2e-only');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(fs.readFile(credentialFilePath, 'utf8')).rejects.toMatchObject({
    code: 'ENOENT',
  });

  await openSettings.click();
  await falKeyInput.fill('fake-fal-key-for-e2e-only');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await expect(dialog).toBeHidden();

  expect(await fs.readFile(credentialFilePath, 'utf8')).toBe(
    'FAL_KEY="fake-fal-key-for-e2e-only"\n'
  );
  expect((await fs.stat(credentialFilePath)).mode & 0o777).toBe(0o600);
  expect((await readProviderCredentials({
    homeDir: studioE2eRuntime.isolatedHomeDirectory,
  })).providers.find((provider) => provider.provider === 'fal-ai')?.configured).toBe(true);

  await projectLibraryPage.openProject(minimalMovieProject);
  const projectUrl = new URL(page.url());
  projectUrl.searchParams.set('test-context', 'keep');
  const expectedProjectUrl = projectUrl.toString();
  projectUrl.searchParams.set('settings', 'provider-credentials');
  await page.goto(projectUrl.toString());
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(expectedProjectUrl);

  const projectSettings = page.getByRole('button', { name: 'Open Settings' });
  await expect(projectSettings).toBeVisible();
  await projectSettings.click();
  await expect(falKeyInput).toHaveValue('');
  await expect(falKeyInput).toHaveAttribute(
    'placeholder',
    '••••••••••••••••'
  );
  await falKeyInput.fill('replacement-fal-key-for-e2e-only');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await fs.readFile(credentialFilePath, 'utf8')).toContain(
    'fake-fal-key-for-e2e-only'
  );

  await projectSettings.click();
  await falKeyInput.fill('replacement-fal-key-for-e2e-only');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  expect(await fs.readFile(credentialFilePath, 'utf8')).toBe(
    'FAL_KEY="replacement-fal-key-for-e2e-only"\n'
  );
});
