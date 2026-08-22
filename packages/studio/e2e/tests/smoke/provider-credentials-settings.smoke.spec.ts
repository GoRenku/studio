import fs from 'node:fs/promises';
import path from 'node:path';
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
  const openSettings = page.getByRole('button', { name: 'Open Settings' });
  await expect(openSettings).toBeVisible();
  await openSettings.click();

  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByText('fal.ai', { exact: true })).toBeVisible();
  await expect(dialog.getByText('ElevenLabs', { exact: true })).toBeVisible();
  await expect(dialog.getByText('World Labs', { exact: true })).toBeVisible();
  const falKeyInput = dialog.getByLabel('fal.ai', { exact: true });
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

  await projectLibraryPage.openProject(minimalMovieProject);
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
