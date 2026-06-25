import { TakeEditorPanel } from '../../pages/take-editor-panel';
import { test } from '../../fixtures/studio-e2e-test';
import { MediaSurfacePage } from '../../pages/media-surface-page';

test('creates, picks, unpicks, and deletes a take through recoverable deletion', async ({
  page,
  shotVideoTakeProject,
}) => {
  const takeEditor = new TakeEditorPanel(page);

  await takeEditor.gotoTakeEditor(shotVideoTakeProject);
  await takeEditor.createPickAndDeleteNewTake();
});

test('deletes a take from its source surface and restores it from Trash', async ({
  page,
  shotVideoTakeProject,
}) => {
  const takeEditor = new TakeEditorPanel(page);
  const trash = new MediaSurfacePage(page);

  await takeEditor.gotoTakeEditor(shotVideoTakeProject);
  await takeEditor.createPickAndDeleteNewTake();

  await trash.gotoTrash(shotVideoTakeProject);
  await trash.expectDiscardedTakeVisible('Gate pressure');
  await trash.restoreDiscardedTake('Gate pressure');
});
