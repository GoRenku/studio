import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';

test('keeps scene take editor selection across reload and browser navigation', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoProject(shotVideoTakeProject);
  await movieStudio.expectProjectInformationVisible(shotVideoTakeProject);

  await movieStudio.gotoTakeEditor(shotVideoTakeProject, { tab: 'composition' });
  await movieStudio.expectTakeEditorVisible();
  await movieStudio.expectSeededCompositionVisible();

  await page.reload();
  await movieStudio.expectTakeEditorVisible();
  await movieStudio.expectSeededCompositionVisible();

  await page.goBack();
  await movieStudio.expectProjectInformationVisible(shotVideoTakeProject);

  await page.goForward();
  await movieStudio.expectTakeEditorVisible();
  await movieStudio.expectSeededCompositionVisible();
});
