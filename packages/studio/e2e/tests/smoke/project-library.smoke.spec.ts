import { MovieStudioPage } from '../../pages/movie-studio-page';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('opens an isolated movie project from the project library', async ({
  minimalMovieProject,
  page,
  projectLibraryPage,
}) => {
  await projectLibraryPage.goto();
  await projectLibraryPage.expectProjectVisible(minimalMovieProject);

  await projectLibraryPage.openProject(minimalMovieProject);

  await new MovieStudioPage(page).expectProjectInformationVisible(
    minimalMovieProject
  );
  await expect(page.getByRole('button', { name: 'Go to Renku Studio home' }))
    .toBeVisible();
});

test('creates, opens, and deletes an empty Project from the Project Library', async ({
  emptyProjectCreation,
  page,
  projectLibraryPage,
}) => {
  await projectLibraryPage.goto();

  await projectLibraryPage.createEmptyProject(emptyProjectCreation);

  await new MovieStudioPage(page).expectProjectInformationVisible(
    emptyProjectCreation
  );
  await page.getByRole('button', { name: 'Go to Renku Studio home' }).click();
  await projectLibraryPage.expectProjectVisible(emptyProjectCreation);

  await projectLibraryPage.deleteProject(emptyProjectCreation);
});
