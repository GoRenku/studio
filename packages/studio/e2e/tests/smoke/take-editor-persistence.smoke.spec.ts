import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';

test('shows persisted take editor choices after close and reopen', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoTakeEditor(shotVideoTakeProject, { tab: 'composition' });
  await movieStudio.expectSeededCompositionVisible();
  await movieStudio.expectSeededMotionVisible();
  await movieStudio.expectSeededReferencesVisible();
  await movieStudio.expectSeededDialogsVisible();
  await movieStudio.expectSeededAiProductionVisible();

  await movieStudio.closeTakeWorkspace();
  await movieStudio.openTakeCard('Gate pressure');

  await movieStudio.expectSeededCompositionVisible();
  await movieStudio.expectSeededMotionVisible();
  await movieStudio.expectSeededReferencesVisible();
  await movieStudio.expectSeededDialogsVisible();
  await movieStudio.expectSeededAiProductionVisible();
});
