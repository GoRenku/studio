import { MovieStudioPage } from '../../pages/movie-studio-page';
import { SceneDetailPage } from '../../pages/scene-detail-page';
import { SceneShotDetailPage } from '../../pages/scene-shot-detail-page';
import { test } from '../../fixtures/studio-e2e-test';

test('opens act, sequence, and scene details with narrative content', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const sceneDetail = new SceneDetailPage(page);

  await movieStudio.gotoAct(shotVideoTakeProject);
  await movieStudio.expectActVisible();

  await movieStudio.gotoSequence(shotVideoTakeProject);
  await movieStudio.expectSequenceVisible();

  await sceneDetail.gotoNarrative(shotVideoTakeProject);
  await sceneDetail.expectNarrativeVisible();
});

test('selects scene shot cards and updates the shot detail panel', async ({
  page,
  shotVideoTakeProject,
}) => {
  const sceneShots = new SceneShotDetailPage(page);

  await sceneShots.gotoShots(shotVideoTakeProject);
  await sceneShots.expectFirstShotVisible();

  await sceneShots.selectSecondShot();
});
