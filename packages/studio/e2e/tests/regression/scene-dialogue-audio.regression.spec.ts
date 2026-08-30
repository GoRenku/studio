import { SceneDetailPage } from '../../pages/scene-detail-page';
import { expect, test } from '../../fixtures/studio-e2e-test';

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

test('persists the Narrative Dialogue Take selection after closing and reopening', async ({
  page,
  movieProject,
}) => {
  const sceneDetail = new SceneDetailPage(page);
  await sceneDetail.gotoNarrative(movieProject);
  await sceneDetail.openDialogueAudioPanel();
  await page.getByRole('tab', { name: 'Takes' }).click();
  await page.getByRole('button', { name: 'Pick' }).click();
  await expect(page.getByText('Selected')).toBeVisible();

  await page.getByRole('button', { name: 'Close dialogue audio panel' }).click();
  await sceneDetail.openDialogueAudioPanel();
  await page.getByRole('tab', { name: 'Takes' }).click();
  await expect(page.getByText('Selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear selection' })).toBeVisible();
});
