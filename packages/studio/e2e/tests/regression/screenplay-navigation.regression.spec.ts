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

test('selects Scene Beat cards and keeps the Shots placeholder inert', async ({
  page,
  movieProject,
}) => {
  const sceneRoute = `/projects/${encodeURIComponent(movieProject.projectName)}/scenes/${encodeURIComponent(movieProject.sceneId)}`;
  await page.goto(`${sceneRoute}?sceneTab=beats&beat=${movieProject.firstBeatId}`);
  await expect(page.getByText('Gate pressure', { exact: true }).first())
    .toBeVisible();
  await page.getByText('Crew reaction', { exact: true }).first().click();
  await expect(page).toHaveURL(
    `${sceneRoute}?sceneTab=beats&beat=${movieProject.secondBeatId}`
  );
  await expect(page.getByText('Show consequence through human response.'))
    .toBeVisible();

  await page.goto(`${sceneRoute}?sceneTab=shots`);
  const newShot = page.getByRole('button', { name: 'New Shot' });
  await expect(newShot).toBeVisible();
  await newShot.click();
  await expect(page).toHaveURL(`${sceneRoute}?sceneTab=shots`);
});
