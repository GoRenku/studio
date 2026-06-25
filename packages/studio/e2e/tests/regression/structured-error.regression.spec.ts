import { TakeEditorPanel } from '../../pages/take-editor-panel';
import { expect, test } from '../../fixtures/studio-e2e-test';

test('does not show Saved when a reference save returns a structured error', async ({
  page,
  shotVideoTakeProject,
}) => {
  const takeEditor = new TakeEditorPanel(page);

  await page.route('**/reference-inclusions', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'CORE_SHOT_VIDEO_DEPENDENCY_STALE_REFERENCE',
          message: 'Selected reference is no longer available.',
        },
      }),
    });
  });

  await takeEditor.gotoTakeEditor(shotVideoTakeProject, { tab: 'references' });
  await page.getByLabel('Exclude Urban').click();

  await expect(page.getByRole('alert')).toContainText(
    'CORE_SHOT_VIDEO_DEPENDENCY_STALE_REFERENCE: Selected reference is no longer available.'
  );
  await expect(page.getByRole('status').filter({ hasText: 'Saved' }))
    .toHaveCount(0);
});
