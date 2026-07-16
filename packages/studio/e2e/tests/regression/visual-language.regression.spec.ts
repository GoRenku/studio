import { writeStudioE2eProjectFile } from '../../fixtures/studio-e2e-files';
import { samplePng } from '../../fixtures/studio-e2e-project';
import { test } from '../../fixtures/studio-e2e-test';
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
