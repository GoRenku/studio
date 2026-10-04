import { createProjectDataService } from '@gorenku/studio-core/server';
import { writeStudioE2eProjectFile } from '../../fixtures/studio-e2e-files';
import { samplePng } from '../../fixtures/studio-e2e-project';
import { test, expect } from '../../fixtures/studio-e2e-test';
import { VisualLanguagePage } from '../../pages/visual-language-page';

test('creates an inspiration folder, uploads and previews an image, then deletes it', async ({
  page,
  movieProject,
}) => {
  const visualLanguage = new VisualLanguagePage(page);
  const uploadPath = await writeStudioE2eProjectFile({
    project: movieProject,
    projectRelativePath: 'e2e-upload/inspiration-fixture.png',
    contents: samplePng(),
  });

  await visualLanguage.gotoInspiration(movieProject);
  await visualLanguage.createFolder('E2E Inspiration Folder');
  await visualLanguage.uploadPreviewAndDeleteImage(uploadPath);
});

test('opens a movie lookbook definition and shows selected visual content', async ({
  page,
  movieProject,
}) => {
  const visualLanguage = new VisualLanguagePage(page);

  await visualLanguage.gotoLookbook(movieProject);
  await visualLanguage.expectLookbookDefinitionAndMedia();
});

test('uses a newly dropped image set immediately in a generation review', async ({
  page, movieProject, studioE2eRuntime,
}) => {
  const visualLanguage = new VisualLanguagePage(page);
  await visualLanguage.gotoInspiration(movieProject);
  await visualLanguage.createFolder('Dropped references');
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    for (const name of ['first.png', 'second.png']) {
      data.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
    }
    return data;
  }, Array.from(samplePng()));
  await page.getByRole('region', { name: 'Inspiration grabs drop target' })
    .dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('button', { name: 'Preview inspiration image', exact: true })).toHaveCount(2);
  const service = createProjectDataService();
  const input = { projectName: movieProject.projectName, homeDir: studioE2eRuntime.isolatedHomeDirectory };
  const folder = (await service.listInspirationFolders(input)).items.find((folder) => folder.name === 'Dropped references')!;
  const images = (await service.readInspirationFolder({ ...input, folderId: folder.id })).images;
  expect(images).toHaveLength(2);
  const documentPath = 'tmp/operations/media-generation/dropped-references.json';
  await writeStudioE2eProjectFile({ project: movieProject, projectRelativePath: documentPath,
    contents: Buffer.from(JSON.stringify({ provider: 'fal-ai', model: 'openai/gpt-image-2/edit', mediaKind: 'image',
      prompt: 'Create a location reference.', request: { image_urls: images.map((image, index) => ({
        $file: image.projectRelativePath, reviewLabel: `Dropped reference ${index + 1}`,
      })) } })) });
  const preview = await service.readMediaGenerationPreview({ ...input, documentPath });
  expect(preview.diagnostics).toEqual([]);
  expect(preview.references.every((reference) => reference.available)).toBe(true);
  await page.evaluate(({ projectName, resource }) => {
    window.dispatchEvent(new CustomEvent('renku:generation-preview-requested', {
      detail: { projectName, previews: [resource], eventId: 'dropped-reference-review', createdAt: new Date().toISOString() },
    }));
  }, { projectName: movieProject.projectName, resource: preview });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab', { name: 'References' }).click();
  for (const reference of preview.references) {
    const image = dialog.getByRole('img', { name: reference.reviewLabel, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const response = await page.request.get(reference.browserUrl!);
    expect(await response.body()).toEqual(samplePng());
  }
  expect((await service.readInspirationFolder({ ...input, folderId: folder.id })).images.map((image) => image.id))
    .toEqual(images.map((image) => image.id));
});
