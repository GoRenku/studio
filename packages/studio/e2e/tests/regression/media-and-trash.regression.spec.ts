import {
  createDiscardedTakeForTrash,
  importAdditionalLocationSheet,
} from '../../fixtures/studio-e2e-project';
import { test } from '../../fixtures/studio-e2e-test';
import { MediaSurfacePage } from '../../pages/media-surface-page';

test('previews location media and refreshes after a resource change', async ({
  page,
  shotVideoTakeProject,
  studioE2eRuntime,
}) => {
  const mediaSurface = new MediaSurfacePage(page);

  await mediaSurface.gotoLocation(shotVideoTakeProject);
  await mediaSurface.openLocationVisualContent();
  await mediaSurface.previewLocationSheet();

  await importAdditionalLocationSheet({
    runtime: studioE2eRuntime,
    project: shotVideoTakeProject,
    relativePath: 'generated/media/gate-refreshed-location-sheet.png',
    title: 'Gate Refreshed Location Sheet',
  });
  await mediaSurface.publishLocationResourceChange(shotVideoTakeProject);
  await mediaSurface.expectLocationSheetVisible(
    'Gate Refreshed Location Sheet location sheet for browser E2E.'
  );
});

test('lists a discarded take in Trash with available lifecycle controls', async ({
  page,
  trashProject,
  studioE2eRuntime,
}) => {
  const mediaSurface = new MediaSurfacePage(page);

  await createDiscardedTakeForTrash({
    runtime: studioE2eRuntime,
    project: trashProject,
  });
  await mediaSurface.gotoTrash(trashProject);
  await mediaSurface.expectDiscardedTakeVisible();
});
