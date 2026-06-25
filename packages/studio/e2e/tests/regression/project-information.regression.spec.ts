import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';

test('saves project information edits and keeps them after reload', async ({
  minimalMovieProject,
  page,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const edited = {
    title: 'E2E Persisted Project Information',
    logline: 'A saved browser edit becomes durable project metadata.',
    summary:
      'The project information panel autosaves user edits and reloads from the saved resource.',
  };

  await movieStudio.gotoProject(minimalMovieProject);
  await movieStudio.editProjectInformation(edited);

  await page.reload();
  await movieStudio.expectProjectInformationValues(edited);
});
