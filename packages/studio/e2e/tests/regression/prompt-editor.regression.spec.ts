import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/studio-e2e-test';

test.setTimeout(120_000);

test('edits a provider request and inspects saved provenance through the shared view', async ({
  page,
  movieProject,
  generationPromptProject,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${encodeURIComponent(movieProject.projectName)}`);
  await openGenerationPreview({
    page,
    projectName: movieProject.projectName,
    preview: generationPromptProject.preview,
  });

  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Media Generation Request', { exact: true })).toBeVisible();
  await expectDesktopDialogGeometry(dialog);
  let editor = dialog.getByRole('textbox', { name: 'Media generation prompt' });
  await expect(editor).toHaveAttribute('aria-readonly', 'false');
  await expect(editor).toContainText('# Imperial Council Chamber');
  const update = dialog.getByRole('button', { name: 'Update' });
  await expect(update).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /generate/i })).toHaveCount(0);

  await editor.press('ControlOrMeta+End');
  await page.keyboard.insertText('\nPreserve the reviewed room axis.');
  await expect(editor).toContainText('Preserve the reviewed room axis.');
  await expect(update).toBeEnabled();
  await update.click();
  await expect(update).toBeDisabled();

  const documentPath = generationPromptProject.preview.documentPath;
  if (!documentPath) {
    throw new Error('Expected the editable Preview fixture to expose its document path.');
  }
  await expect.poll(async () => {
    const document = JSON.parse(await fs.readFile(
      path.join(movieProject.projectPath, documentPath),
      'utf8',
    )) as { prompt?: string };
    return document.prompt;
  }).toContain('Preserve the reviewed room axis.');

  await assertReferenceAndConfigurationTabs(dialog);
  await dialog.locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.goto(
    `/projects/${encodeURIComponent(movieProject.projectName)}` +
    `/cast/${encodeURIComponent(movieProject.castMemberId)}`,
  );
  await page.getByRole('tab', { name: 'Assets' }).click();
  await expect(page.getByRole('heading', { name: 'Character Sheets' })).toBeVisible();
  const savedCard = page.locator('[data-media-card]').filter({
    hasText: generationPromptProject.inspectorCardTitle,
  });
  await expect(savedCard).toHaveCount(1);
  await savedCard.getByRole('button', { name: 'View generation request' }).click();

  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Media Generation Request', { exact: true })).toBeVisible();
  await expectDesktopDialogGeometry(dialog);
  editor = dialog.getByRole('textbox', { name: 'Media generation prompt' });
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  await expect(editor).toContainText('# Imperial Council Chamber');
  await expect(dialog.getByRole('button', { name: 'Update' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /generate/i })).toHaveCount(0);

  await editor.focus();
  await page.keyboard.insertText('MUTATION');
  await expect(editor).not.toContainText('MUTATION');
  await expect(editor).toContainText('# Imperial Council Chamber');
  await assertReferenceAndConfigurationTabs(dialog);
});

async function openGenerationPreview(input: {
  page: Page;
  projectName: string;
  preview: MediaGenerationPreviewResource;
}): Promise<void> {
  await input.page.evaluate(({ projectName, preview }) => {
    window.dispatchEvent(new CustomEvent('renku:generation-preview-requested', {
      detail: {
        projectName,
        previews: [preview],
        eventId: `media-generation-preview-e2e-${Date.now()}`,
      },
    }));
  }, { projectName: input.projectName, preview: input.preview });
  await expect(input.page.getByRole('dialog')).toBeVisible();
}

async function assertReferenceAndConfigurationTabs(dialog: Locator): Promise<void> {
  await dialog.getByRole('tab', { name: 'References' }).click();
  await expect(dialog.getByText(/prompt-reference-chamber\.png/)).toBeVisible();
  await expect(dialog.getByText(/prompt-reference-lookbook\.png/)).toBeVisible();

  await dialog.getByRole('tab', { name: 'Configuration' }).click();
  await expect(dialog.getByText('fal-ai', { exact: true })).toBeVisible();
  await expect(dialog.getByText('openai/gpt-image-2/edit', { exact: true })).toBeVisible();
  await expect(dialog.getByText('image_size', { exact: true })).toBeVisible();
  await expect(dialog.getByText('"landscape_16_9"', { exact: true })).toBeVisible();
}

async function expectDesktopDialogGeometry(dialog: Locator): Promise<void> {
  await dialog.page().waitForTimeout(300);
  const bounds = await dialog.boundingBox();
  if (!bounds) {
    throw new Error('Expected the media generation request dialog to be visible.');
  }
  expect(bounds.width).toBeCloseTo(1120, 0);
  expect(bounds.height).toBeCloseTo(760, 0);
}
