import { importAdditionalLocationSheet } from '../../fixtures/studio-e2e-project';
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

  await importAdditionalLocationSheet({
    runtime: studioE2eRuntime,
    project: movieProject,
    relativePath: 'generated/media/gate-refreshed-location-sheet.png',
    title: 'Gate Refreshed Location Sheet',
  });
  await mediaSurface.publishLocationResourceChange(movieProject);
  await mediaSurface.expectLocationSheetVisible(
    'Gate Refreshed Location Sheet location sheet for browser E2E.'
  );
});
