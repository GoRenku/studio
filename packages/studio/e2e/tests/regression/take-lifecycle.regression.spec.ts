import { TakeEditorPanel } from '../../pages/take-editor-panel';
import { test } from '../../fixtures/studio-e2e-test';

test('creates, picks, unpicks, and deletes a take through recoverable deletion', async ({
  page,
  shotVideoTakeProject,
}) => {
  const takeEditor = new TakeEditorPanel(page);

  await takeEditor.gotoTakeEditor(shotVideoTakeProject);
  await takeEditor.createPickAndDeleteNewTake();
});
