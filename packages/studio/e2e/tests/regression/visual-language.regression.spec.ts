import { writeStudioE2eProjectFile } from '../../fixtures/studio-e2e-files';
import { samplePng } from '../../fixtures/studio-e2e-project';
import { test } from '../../fixtures/studio-e2e-test';
import { VisualLanguagePage } from '../../pages/visual-language-page';

test('creates an inspiration folder, uploads and previews an image, then deletes it', async ({
  page,
  shotVideoTakeProject,
}) => {
  const visualLanguage = new VisualLanguagePage(page);
  const uploadPath = await writeStudioE2eProjectFile({
    project: shotVideoTakeProject,
    projectRelativePath: 'e2e-upload/inspiration-fixture.png',
    contents: samplePng(),
  });

  await visualLanguage.gotoInspiration(shotVideoTakeProject);
  await visualLanguage.createFolder('E2E Inspiration Folder');
  await visualLanguage.uploadPreviewAndDeleteImage(uploadPath);
});

test('opens a movie lookbook definition and shows selected visual content', async ({
  page,
  shotVideoTakeProject,
}) => {
  const visualLanguage = new VisualLanguagePage(page);

  await visualLanguage.gotoLookbook(shotVideoTakeProject);
  await visualLanguage.expectLookbookDefinitionAndMedia();
});

test('exposes production export from selected project media', async ({
  page,
  shotVideoTakeProject,
}) => {
  const visualLanguage = new VisualLanguagePage(page);

  await visualLanguage.gotoLookbook(shotVideoTakeProject);
  await visualLanguage.expectProductionExportCommandVisible();
});
