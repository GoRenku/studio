import { SceneDetailPage } from '../../pages/scene-detail-page';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('shows Shot Plan dialogue audio after reload', async ({
  page,
  movieProject,
}) => {
  const sceneDetail = new SceneDetailPage(page);

  await sceneDetail.gotoShotPlanAudio(movieProject);
  await sceneDetail.expectDialogueAudioTakeVisible();

  await page.reload();
  await sceneDetail.expectDialogueAudioTakeVisible();
});

test('persists multi-selection for Shot Plan dialogue audio', async ({
  page,
  movieProject,
}) => {
  const sceneDetail = new SceneDetailPage(page);
  await sceneDetail.gotoShotPlanAudio(movieProject);
  await page.getByRole('button', { name: 'Select Turn 1 as audio context' }).click();
  await expect(page.getByRole('button', {
    name: 'Remove Turn 1 from selected audio',
  })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.getByRole('button', {
    name: 'Remove Turn 1 from selected audio',
  })).toHaveAttribute('aria-pressed', 'true');
});
