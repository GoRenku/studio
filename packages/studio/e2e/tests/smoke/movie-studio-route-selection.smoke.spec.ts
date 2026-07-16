import { expect, test } from '../../fixtures/studio-e2e-test';

test('keeps Scene Beat and Shots route selection across reload and browser navigation', async ({
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

  await page.goto(`${sceneRoute}?sceneTab=shots`);
  await expect(page.getByRole('button', { name: 'New Shot' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(beatRoute);
  await page.goForward();
  await expect(page).toHaveURL(`${sceneRoute}?sceneTab=shots`);
  await expect(page.getByRole('button', { name: 'New Shot' })).toBeVisible();
});
