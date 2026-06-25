import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';

test('adds a shot to a take group without losing persisted take tab choices', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoTakeEditor(shotVideoTakeProject, { tab: 'composition' });
  await movieStudio.expectSeededCompositionVisible();

  await movieStudio.addSecondShotToCurrentTake();
  await movieStudio.expectCurrentTakeIncludesTwoShots();

  await movieStudio.selectFirstShot();
  await movieStudio.openShotDetailTab('composition');
  await movieStudio.expectSeededCompositionVisible();

  await page.reload();
  await movieStudio.expectCurrentTakeIncludesTwoShots();
  await movieStudio.selectFirstShot();
  await movieStudio.expectSeededCompositionVisible();
});
