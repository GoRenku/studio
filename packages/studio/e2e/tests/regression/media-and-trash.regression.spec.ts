import { runStudioE2eMediaImport } from '../../fixtures/studio-e2e-cli';
import { writeStudioE2eImageSource } from '../../fixtures/studio-e2e-project';
import { test } from '../../fixtures/studio-e2e-test';
import { MediaSurfacePage } from '../../pages/media-surface-page';

test('previews location media and refreshes after a resource change', async ({
  page,
  movieProject,
  studioE2eRuntime,
}) => {
  const mediaSurface = new MediaSurfacePage(page);

  await mediaSurface.gotoLocation(movieProject);
  await mediaSurface.openLocationVisualContent();
  await mediaSurface.previewLocationSheet();

  const source = 'generated/media/gate-refreshed-location-sheet.png';
  await writeStudioE2eImageSource({
    runtime: studioE2eRuntime,
    project: movieProject,
    relativePath: source,
  });
  const refreshed = mediaSurface.waitForResourcePoll(
    `surface:location:${movieProject.locationId}`
  );
  await runStudioE2eMediaImport({
    runtime: studioE2eRuntime,
    projectName: movieProject.projectName,
    purpose: 'location.sheet',
    target: `location:${movieProject.locationId}`,
    source,
    title: 'Gate Refreshed Location Sheet',
  });
  await refreshed;
  await mediaSurface.expectLocationSheetVisible('Location sheet');
});
