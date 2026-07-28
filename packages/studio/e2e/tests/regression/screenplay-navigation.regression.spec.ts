import { MovieStudioPage } from '../../pages/movie-studio-page';
import { SceneDetailPage } from '../../pages/scene-detail-page';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('opens act, sequence, and scene details with narrative content', async ({
  page,
  movieProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const sceneDetail = new SceneDetailPage(page);

  await movieStudio.gotoAct(movieProject);
  await movieStudio.expectActVisible();

  await movieStudio.gotoSequence(movieProject);
  await movieStudio.expectSequenceVisible();

  await sceneDetail.gotoNarrative(movieProject);
  await sceneDetail.expectNarrativeVisible();
});

test('selects Scene Beats and navigates the Shot Plan rail', async ({
  page,
  movieProject,
}) => {
  const sceneRoute = `/projects/${encodeURIComponent(movieProject.projectName)}/scenes/${encodeURIComponent(movieProject.sceneId)}`;
  await page.goto(`${sceneRoute}?sceneTab=beats&beat=${movieProject.firstBeatId}`);
  await expect(page.getByText('Gate pressure', { exact: true }).first())
    .toBeVisible();
  await page.getByRole('button', { name: 'Beat 2 - Crew reaction' }).click();
  await expect(page).toHaveURL(
    `${sceneRoute}?sceneTab=beats&beat=${movieProject.secondBeatId}`
  );
  await expect(page.getByText('Show consequence through human response.'))
    .toBeVisible();

  await page.goto(`${sceneRoute}?sceneTab=shotPlans`);
  await page.getByRole('button', {
    name: 'Open Shot Plan Gate pressure coverage',
  }).click();
  await page.getByRole('button', { name: 'Select Shot 2' }).click();
  await expect(page).toHaveURL(
    `${sceneRoute}?sceneTab=shotPlans&shotPlan=${movieProject.shotPlanId}&shot=${movieProject.secondShotId}`
  );
  await expect(
    page.getByRole('heading', { name: 'The crew absorbs the result' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to Shot Plans' }).click();
  await expect(page).toHaveURL(`${sceneRoute}?sceneTab=shotPlans`);
});
