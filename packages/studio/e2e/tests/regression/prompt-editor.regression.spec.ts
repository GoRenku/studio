import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/studio-e2e-test';
import { generationPromptDocument } from '../../fixtures/studio-e2e-generation-preview';

test.setTimeout(120_000);

test('keeps rich prompt editing, completion, preview, and read-only geometry reliable', async ({
  page,
  movieProject,
  generationPromptProject,
}) => {
  const referenceOneLabel = generationPromptProject.preview.references.additional.find(
    (reference) => reference.promptMention === '@Reference1',
  )?.label;
  if (!referenceOneLabel) {
    throw new Error('Expected the prompt fixture to project @Reference1.');
  }
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/projects/${encodeURIComponent(movieProject.projectName)}`);
  await setTheme(page, 'light');
  await openGenerationPreview(page, generationPromptProject.preview);
  let dialog = page.getByRole('dialog');
  await capturePromptStates(page, dialog, referenceOneLabel, 'light');

  await closeDialog(dialog);
  await setTheme(page, 'dark');
  await openGenerationPreview(page, generationPromptProject.preview);
  dialog = page.getByRole('dialog');
  await capturePromptStates(page, dialog, referenceOneLabel, 'dark');

  const editor = dialog.getByRole('textbox', { name: 'Generation prompt' });
  let preview = dialog.getByRole('img', { name: referenceOneLabel });
  await editor.press('ControlOrMeta+Home');
  await page.waitForTimeout(100);
  const topLine = dialog.getByText(
    '- Hold frontal symmetry until the political balance starts to fracture.',
    { exact: true },
  );
  await clickNearLineEnd(page, topLine);
  await page.keyboard.type(' [TOP]');
  await expect(editor).toContainText('[TOP]');
  expect(await lineContaining(editor, '[TOP]')).toContain('frontal symmetry');

  const middleLine = dialog.getByText(
    'The emperor remains at the long map table while Urban presents the cannon design from the room axis. Loukas Notaras holds the shadowed edge of the group. Leave enough negative space for the chamber to feel diminished around them.',
    { exact: true },
  );
  await middleLine.scrollIntoViewIfNeeded();
  await clickNearLineEnd(page, middleLine);
  await page.keyboard.type(' [MIDDLE]');
  expect(await lineContaining(editor, '[MIDDLE]')).toContain('long map table');

  const unknownLine = dialog.getByText(
    'Unknown authored tokens such as @Unknown remain ordinary prompt text.',
    { exact: true },
  );
  await unknownLine.scrollIntoViewIfNeeded();
  await expect(unknownLine.locator('.cm-prompt-reference-mention')).toHaveCount(0);
  await page.mouse.move(1, 1);
  await expect(preview).toBeHidden();
  const unknownRect = await textRangeRect(page, '@Unknown');
  await page.mouse.move(
    unknownRect.x + unknownRect.width / 2,
    unknownRect.y + unknownRect.height / 2,
  );
  await expect(preview).toBeHidden();

  const bottomLine = dialog.getByText(
    'End on a measured wide composition where maps, unpaid ledgers, and broken arrowheads turn administration into pressure. Keep the image sober, legible, historically tactile, and emotionally restrained.',
    { exact: true },
  );
  await bottomLine.scrollIntoViewIfNeeded();
  await clickNearLineEnd(page, bottomLine);
  await page.keyboard.type(' [BOTTOM]');
  expect(await lineContaining(editor, '[BOTTOM]')).toContain('measured wide composition');

  await page.keyboard.type(' SELECTME');
  for (let index = 0; index < 'SELECTME'.length; index += 1) {
    await page.keyboard.press('Shift+ArrowLeft');
  }
  await page.keyboard.type('REPLACED');
  await expect(editor).toContainText('REPLACED');
  await expect(editor).not.toContainText('SELECTME');

  const beforePaste = await editorDocumentText(editor);
  await page.evaluate(async () => navigator.clipboard.writeText(' PASTED'));
  await page.keyboard.press('ControlOrMeta+V');
  await expect(editor).toContainText('PASTED');
  const afterPaste = await editorDocumentText(editor);
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(() => editorDocumentText(editor)).toBe(beforePaste);
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect.poll(() => editorDocumentText(editor)).toBe(afterPaste);

  await editor.press('ControlOrMeta+End');
  await page.keyboard.type('\n@Ref');
  const completion = page.getByRole('listbox');
  await expect(completion).toBeVisible();
  await expect(completion).toContainText(referenceOneLabel);
  await expect(completion).toContainText('@Reference1');
  await expect(completion.locator('img')).toHaveCount(2);
  await expectAnchoredInside(completion, editor, page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('@Reference2');
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(() => editorDocumentText(editor)).toContain('@Ref');

  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('@');
  await expect(completion).toBeVisible();
  const firstOption = completion.getByRole('option').filter({
    hasText: referenceOneLabel,
  });
  await firstOption.click();
  await expect(editor).toContainText('@Reference1');

  const insertedMention = editor.locator('.cm-prompt-reference-mention').last();
  await expect(insertedMention).toBeVisible();
  await editor.press('ControlOrMeta+End');
  await page.waitForTimeout(100);
  await expect(preview).toBeVisible();
  await expectAnchoredInside(preview.locator('..'), editor, page);
  await clickLocator(page, insertedMention);
  await expect(preview).toBeVisible();

  await page.mouse.move(1, 1);
  await page.keyboard.press('ControlOrMeta+Home');
  await expect(preview).toBeHidden();
  expect(await editor.locator('.cm-prompt-reference-mention').allTextContents())
    .not.toContain('@Unknown');

  await expect(dialog.locator('[data-slot="dialog-footer"]')).toBeVisible();
  await expect(editor.locator('..')).toHaveCSS('overflow', 'auto');

  await closeDialog(dialog);
  await page.goto(
    `/projects/${encodeURIComponent(movieProject.projectName)}/cast/${encodeURIComponent(movieProject.castMemberId)}`,
  );
  await page.getByRole('tab', { name: 'Assets' }).click();
  await expect(page.getByRole('heading', { name: 'Character Sheets' })).toBeVisible();
  const savedCard = page.locator('[data-media-card]').filter({
    hasText: generationPromptProject.inspectorCardTitle,
  });
  await expect(savedCard).toHaveCount(1);
  await savedCard.getByRole('button', { name: 'View generation request' }).click();

  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Generation Request', { exact: true })).toBeVisible();
  const readOnlyEditor = dialog.getByRole('textbox', { name: 'Generation prompt' });
  await expect(readOnlyEditor).toHaveAttribute('aria-readonly', 'true');
  await readOnlyEditor.focus();
  await readOnlyEditor.press('ControlOrMeta+A');
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
    .toContain('# Imperial Council Chamber');
  await readOnlyEditor.press('ControlOrMeta+C');
  await expect.poll(() => page.evaluate(async () => navigator.clipboard.readText()))
    .toContain('# Imperial Council Chamber');

  const savedValue = await editorDocumentText(readOnlyEditor);
  await page.keyboard.type('MUTATION');
  await page.evaluate(async () => navigator.clipboard.writeText('PASTE MUTATION'));
  await page.keyboard.press('ControlOrMeta+V');
  await page.keyboard.type('@Ref');
  expect(await editorDocumentText(readOnlyEditor)).toBe(savedValue);
  await expect(page.getByRole('listbox')).toBeHidden();

  await readOnlyEditor.press('ControlOrMeta+Home');
  await page.waitForTimeout(100);
  const readOnlyMention = readOnlyEditor.locator('.cm-prompt-reference-mention').first();
  await expect(readOnlyMention).toBeVisible();
  await clickLocator(page, readOnlyMention);
  preview = dialog.getByRole('img', {
    name: referenceOneLabel,
  });
  await expect(preview).toBeVisible();
  await expectAnchoredInside(preview.locator('..'), readOnlyEditor, page);
  await expect(dialog.locator('[data-slot="dialog-footer"]')).toBeVisible();
});

async function capturePromptStates(
  page: Page,
  dialog: Locator,
  referenceOneLabel: string,
  theme: 'dark' | 'light',
): Promise<void> {
  const editor = dialog.getByRole('textbox', { name: 'Generation prompt' });
  await page.evaluate(async () => document.fonts.ready);
  await expect(editor).toContainText('Imperial Council Chamber');
  await expect(dialog).toHaveScreenshot(`prompt-editor-${theme}-normal.png`, {
    animations: 'disabled',
    caret: 'hide',
  });

  const mention = editor.locator('.cm-prompt-reference-mention').first();
  await expect(mention).toBeVisible();
  await hoverLocator(page, mention);
  await expect(dialog.getByRole('img', {
    name: referenceOneLabel,
  })).toBeVisible();
  await expect(dialog).toHaveScreenshot(`prompt-editor-${theme}-preview.png`, {
    animations: 'disabled',
    caret: 'hide',
  });
  await page.mouse.move(1, 1);

  await editor.press('ControlOrMeta+End');
  await page.keyboard.type('\n@');
  const completion = page.getByRole('listbox');
  await expect(completion).toBeVisible();
  await expect(dialog).toHaveScreenshot(`prompt-editor-${theme}-completion.png`, {
    animations: 'disabled',
    caret: 'hide',
  });
  await page.keyboard.press('Enter');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await editorDocumentText(editor) === generationPromptDocument) break;
    await page.keyboard.press('ControlOrMeta+Z');
  }
  await expect.poll(() => editorDocumentText(editor)).toBe(generationPromptDocument);
  await page.waitForTimeout(700);
}

async function openGenerationPreview(
  page: Page,
  preview: import('@gorenku/studio-core/client').GenerationPreviewResource,
): Promise<void> {
  await page.evaluate((resource) => {
    window.dispatchEvent(new CustomEvent('renku:generation-preview-requested', {
      detail: {
        projectName: resource.project.name,
        previews: [resource],
        eventId: `prompt-editor-e2e-${Date.now()}`,
        createdAt: '2026-07-20T10:00:00.000Z',
      },
    }));
  }, preview);
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function closeDialog(dialog: Locator): Promise<void> {
  if (await dialog.isVisible()) {
    await dialog.page().keyboard.press('Escape');
  }
  await expect(dialog).toBeHidden();
}

async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  const desiredLabel = theme === 'dark'
    ? 'Switch to dark mode'
    : 'Switch to light mode';
  const switchControl = page.getByRole('switch', { name: desiredLabel });
  if (await switchControl.isVisible()) {
    await switchControl.click();
  }
}

async function clickNearLineEnd(page: Page, line: Locator): Promise<void> {
  const bounds = await line.boundingBox();
  if (!bounds) throw new Error('Expected a visible prompt line.');
  await page.mouse.click(
    bounds.x + Math.max(1, bounds.width - 4),
    bounds.y + bounds.height / 2,
  );
}

async function lineContaining(editor: Locator, marker: string): Promise<string> {
  const value = await editorDocumentText(editor);
  const line = value?.split('\n').find((candidate) => candidate.includes(marker));
  if (!line) throw new Error(`Expected a line containing ${marker}.`);
  return line;
}

async function editorDocumentText(editor: Locator): Promise<string> {
  return (await editor.innerText()).replace(/\n{3,}/g, '\n\n');
}

async function expectAnchoredInside(
  floating: Locator,
  editor: Locator,
  page: Page,
): Promise<void> {
  const [floatingBox, editorBox, caretBox] = await Promise.all([
    floating.boundingBox(),
    editor.locator('..').boundingBox(),
    page.evaluate(() => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const bounds = range?.getBoundingClientRect();
      return bounds
        ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        : null;
    }),
  ]);
  if (!floatingBox || !editorBox) {
    throw new Error('Expected editor and tooltip geometry.');
  }
  expect(floatingBox.x).toBeGreaterThanOrEqual(editorBox.x - 1);
  expect(floatingBox.y).toBeGreaterThanOrEqual(editorBox.y - 1);
  expect(floatingBox.x + floatingBox.width)
    .toBeLessThanOrEqual(editorBox.x + editorBox.width + 1);
  expect(floatingBox.y + floatingBox.height)
    .toBeLessThanOrEqual(editorBox.y + editorBox.height + 1);
  if (caretBox) {
    expect(Math.abs(floatingBox.y - caretBox.y)).toBeLessThan(editorBox.height);
  }
}

async function textRangeRect(
  page: Page,
  text: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate((target) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const index = node.textContent?.indexOf(target) ?? -1;
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + target.length);
        const bounds = range.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      }
      node = walker.nextNode();
    }
    throw new Error(`Expected rendered text: ${target}`);
  }, text);
}

async function hoverLocator(page: Page, locator: Locator): Promise<void> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected visible text geometry.');
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    { steps: 8 },
  );
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Expected visible text geometry.');
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
}
