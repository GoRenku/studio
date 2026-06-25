import { MovieStudioPage } from '../../pages/movie-studio-page';
import { test } from '../../fixtures/studio-e2e-test';
import {
  importAdditionalCastProfileImage,
} from '../../fixtures/studio-e2e-project';

test('opens media preview, updates profile pick, and refreshes after resource change', async ({
  page,
  shotVideoTakeProject,
  studioE2eRuntime,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoCastMember(shotVideoTakeProject);
  await movieStudio.openCastAssetsTab();

  await movieStudio.openProfileImagePreview({
    cardName: 'Urban Profile',
    dialogName: 'Urban profile',
  });
  await movieStudio.clearProfileImagePick();

  await importAdditionalCastProfileImage({
    runtime: studioE2eRuntime,
    project: shotVideoTakeProject,
    relativePath: 'generated/media/urban-refreshed-profile.png',
    title: 'urban-refreshed-profile',
  });
  await movieStudio.publishCastAssetResourceChange(shotVideoTakeProject);
  await movieStudio.expectProfileImageVisible('Urban Refreshed Profile');
});
