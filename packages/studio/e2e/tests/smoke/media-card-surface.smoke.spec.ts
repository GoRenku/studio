import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';
import {
  importAdditionalCastProfileImage,
} from '../../fixtures/studio-e2e-project';

test('opens media preview, updates profile pick, and refreshes after resource change', async ({
  page,
  movieProject,
  studioE2eRuntime,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoCastMember(movieProject);
  await movieStudio.openCastAssetsTab();

  await movieStudio.openProfileImagePreview({
    cardName: 'Urban Profile',
    dialogName: 'Urban profile',
  });
  await movieStudio.clearProfileImagePick();

  await importAdditionalCastProfileImage({
    runtime: studioE2eRuntime,
    project: movieProject,
    relativePath: 'generated/media/urban-refreshed-profile.png',
    title: 'urban-refreshed-profile',
  });
  await movieStudio.publishCastAssetResourceChange(movieProject);
  await movieStudio.expectProfileImageVisible('Urban Refreshed Profile');
});
