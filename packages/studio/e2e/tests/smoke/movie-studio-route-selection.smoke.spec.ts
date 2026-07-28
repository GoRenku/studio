import { expect, test } from '../../fixtures/studio-e2e-test';

test('keeps Scene Beat and Shot Plan detail across reload and browser navigation', async ({
  page,
  movieProject,
}) => {
  const projectRoute = `/projects/${encodeURIComponent(movieProject.projectName)}`;
  const sceneRoute = `${projectRoute}/scenes/${encodeURIComponent(movieProject.sceneId)}`;
  const beatRoute = `${sceneRoute}?sceneTab=beats&beat=${movieProject.secondBeatId}`;

  await page.goto(projectRoute);
  await expect(page.getByLabel('Title')).toHaveValue(movieProject.title);

  await page.goto(beatRoute);
  await expect(page.getByText('Crew reaction', { exact: true }).first())
    .toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(beatRoute);
  await expect(page.getByText('Show consequence through human response.'))
    .toBeVisible();

  const shotPlansRoute = `${sceneRoute}?sceneTab=shotPlans`;
  const shotPlanRoute = `${shotPlansRoute}&shotPlan=${movieProject.shotPlanId}&shot=${movieProject.firstShotId}`;
  await page.goto(shotPlansRoute);
  await expect(
    page.getByRole('heading', { name: 'Gate pressure coverage' })
  ).toBeVisible();
  await page.getByRole('button', {
    name: 'Open Shot Plan Gate pressure coverage',
  }).click();
  await expect(page).toHaveURL(shotPlanRoute);
  await expect(
    page.getByRole('heading', { name: 'Urban holds beside the cannon' })
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(shotPlanRoute);

  await page.goBack();
  await expect(page).toHaveURL(shotPlansRoute);
  await page.goForward();
  await expect(page).toHaveURL(shotPlanRoute);
});
