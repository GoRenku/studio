import { TakeEditorPanel } from '../../pages/take-editor-panel';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('does not show Saved when a reference save returns a structured error', async ({
  page,
  shotVideoTakeProject,
}) => {
  const takeEditor = new TakeEditorPanel(page);

  await page.route('**/generation/references', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'CORE_SHOT_VIDEO_TAKE_REFERENCE_NOT_FOUND',
          message: 'Selected reference is no longer available.',
        },
      }),
    });
  });

  await takeEditor.gotoTakeEditor(shotVideoTakeProject, { tab: 'references' });
  await page.getByRole('button', { name: /^(Include|Exclude) / }).first().click();

  await expect(page.getByRole('alert')).toContainText(
    'CORE_SHOT_VIDEO_TAKE_REFERENCE_NOT_FOUND: Selected reference is no longer available.'
  );
  await expect(page.getByRole('status').filter({ hasText: 'Saved' }))
    .toHaveCount(0);
});
