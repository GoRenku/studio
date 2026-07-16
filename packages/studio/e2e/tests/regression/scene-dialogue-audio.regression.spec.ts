import { SceneDetailPage } from '../../pages/scene-detail-page';
import { test } from '../../fixtures/studio-e2e-test';

test('shows simulated dialogue audio generation output after reload', async ({
  page,
  movieProject,
}) => {
  const sceneDetail = new SceneDetailPage(page);

  await sceneDetail.gotoNarrative(movieProject);
  await sceneDetail.openDialogueAudioPanel();
  await sceneDetail.expectSimulatedDialogueAudioTakeVisible();

  await page.reload();
  await sceneDetail.expectNarrativeVisible();
  await sceneDetail.expectGeneratedDialogueAudioAvailable();
});
