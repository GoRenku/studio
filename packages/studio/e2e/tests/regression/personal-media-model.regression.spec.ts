import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectDataService, importPersonalMediaModel, listMediaModels, readMediaModel } from '@gorenku/studio-core/server';
import { test, expect } from '../../fixtures/studio-e2e-test';

test('shows an unguided personal route in desktop generation Preview', async ({
  page, minimalMovieProject, studioE2eRuntime,
}) => {
  const homeDir = studioE2eRuntime.isolatedHomeDirectory;
  const provider = 'fal-ai';
  const apiId = 'fixture/personal-image';
  const library = await listMediaModels({ homeDir });
  await importPersonalMediaModel({ homeDir, expectedRevision: library.revision,
    providerIds: [provider], route: { provider, apiId, name: 'Personal image model' } });
  const model = await readMediaModel({ homeDir, provider, apiId });
  await expect(fs.stat(model.personalGuidePath)).rejects.toMatchObject({ code: 'ENOENT' });
  const documentPath = 'tmp/operations/media-generation/personal-model.json';
  const absolutePath = path.join(minimalMovieProject.projectPath, documentPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, JSON.stringify({
    provider, model: apiId, mediaKind: 'image', prompt: 'An empty stone courtyard.',
    request: { prompt: 'An empty stone courtyard.', size: 'landscape' },
  }));
  const preview = await createProjectDataService().readMediaGenerationPreview({
    homeDir, projectName: minimalMovieProject.projectName, documentPath,
  });
  expect(preview.diagnostics).toEqual([]);
  await page.goto(`/projects/${encodeURIComponent(minimalMovieProject.projectName)}`);
  await expect(page.getByRole('main')).toBeVisible();
  await page.evaluate(({ projectName, previewJson }) => {
    window.dispatchEvent(new CustomEvent('renku:generation-preview-requested', {
      detail: { projectName, previews: [JSON.parse(previewJson)], eventId: 'personal-model-e2e',
        createdAt: '2026-09-19T12:00:00.000Z' },
    }));
  }, { projectName: minimalMovieProject.projectName, previewJson: JSON.stringify(preview) });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Media generation prompt' }))
    .toContainText('An empty stone courtyard.');
  await dialog.getByRole('tab', { name: 'Configuration' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Model', exact: true })).toHaveValue(apiId);
  await expect(dialog.getByRole('textbox', { name: 'Size', exact: true })).toHaveValue('landscape');
});
