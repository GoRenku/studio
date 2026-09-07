import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { expect, test } from '../../fixtures/studio-e2e-test';

const service = createProjectDataService();
const scene = (name: string, speech = 'Wait.') => `<Paragraph Type="Scene Heading"><Text>INT. ${name} - DAY</Text></Paragraph><Paragraph Type="Character"><Text>MARA</Text></Paragraph><Paragraph Type="Dialogue"><Text>${speech}</Text></Paragraph>`;
const fdx = (content: string) => `<FinalDraft DocumentType="Script"><Content>${content}</Content></FinalDraft>`;

test('detects a dialogue export on a production tab, defers, reviews, applies and preserves history', async ({ page, studioE2eRuntime, minimalMovieProject }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const input = { homeDir: studioE2eRuntime.isolatedHomeDirectory, projectName: minimalMovieProject.projectName };
  const sourcePath = path.join(studioE2eRuntime.isolatedHomeDirectory, 'external-update.fdx');
  await fs.writeFile(sourcePath, fdx(scene('ROOM') + scene('GARDEN')));
  await service.importFdxScreenplay({ ...input, sourcePath });
  await service.openCurrentProject(input);
  const before = await service.readScreenplayStructure(input);
  const first = before.screenplay.scenes[0]!;
  const beats = await service.createSceneBeatsRevision({ homeDir: input.homeDir, document: { sceneId: first.id, beats: [{
    title: 'Waiting', description: 'Mara waits.', narrativeDevelopment: 'A pause.', narrativePurpose: 'Build anticipation.',
    castMemberIds: [], locationIds: [], propIds: [], screenplayBlockIds: first.blocks.map((block) => block.id),
  }] } });
  const { exportPath } = await service.prepareFdxExportFolder(input);
  await page.goto(`/projects/${input.projectName}/scenes/${first.id}`);
  await page.getByRole('tab', { name: 'Beats', exact: true }).click();
  await page.bringToFront();
  const started = Date.now();
  await fs.writeFile(exportPath, fdx(scene('ROOM', 'Wait!') + scene('GARDEN')));
  const dialog = page.getByRole('dialog', { name: 'Update screenplay?' });
  await expect(dialog).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();
  testInfo.annotations.push({ type: 'detection-latency-ms', description: String(Date.now() - started) });
  await expect(dialog.getByText(/Existing work for 1 Scene/)).toBeVisible();
  await expect(dialog.getByText(/Active Beats/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Later' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('dialogue-review-1440x900.png') });
  await page.keyboard.press('Enter');
  expect((await service.readScreenplayStructure(input)).screenplay).toEqual(before.screenplay);
  await page.goto(`/projects/${input.projectName}/screenplay`);
  await page.getByRole('button', { name: 'Screenplay update available' }).click();
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Update screenplay', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await service.readScreenplayStructure(input)).screenplay.scenes[0]!.id).not.toBe(first.id);
  expect((await service.readScreenplayStructure(input)).screenplay.scenes[1]).toEqual(before.screenplay.scenes[1]);
  expect(await service.readSceneBeatsRevision({ homeDir: input.homeDir, revisionId: beats.revision.id })).toMatchObject({ sceneBeats: { sceneId: first.id } });

  // A removed active Scene resolves back to the Screenplay surface after apply.
  const current = await service.readScreenplayStructure(input);
  await page.goto(`/projects/${input.projectName}/scenes/${current.screenplay.scenes[0]!.id}`);
  await fs.writeFile(exportPath, fdx(scene('GARDEN') + scene('ROOM', 'Wait!')));
  await expect(dialog).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByText('The order of retained Scenes will change. Their production links stay attached.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Update screenplay', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await service.readScreenplayStructure(input)).screenplay.scenes.map((row) => row.id))
    .toEqual([...current.screenplay.scenes].reverse().map((row) => row.id));
  await fs.writeFile(`${exportPath}.tmp`, fdx(scene('GARDEN')));
  await fs.rename(`${exportPath}.tmp`, exportPath);
  await expect(dialog).toBeVisible({ timeout: 12000 });
  await dialog.getByRole('button', { name: 'Update screenplay', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${input.projectName}/screenplay`));
});

test('catches up on reopen, invalidates a newer export, handles long lists and two-tab acceptance', async ({ page, context, studioE2eRuntime, minimalMovieProject }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const input = { homeDir: studioE2eRuntime.isolatedHomeDirectory, projectName: minimalMovieProject.projectName };
  const sourcePath = path.join(input.homeDir, 'external-long.fdx');
  const original = Array.from({ length: 35 }, (_, index) => scene(`ROOM ${index}`)).join('');
  await fs.writeFile(sourcePath, fdx(original));
  await service.importFdxScreenplay({ ...input, sourcePath });
  const { exportPath } = await service.prepareFdxExportFolder(input);
  await fs.writeFile(exportPath, fdx(scene('NEW')));
  await page.goto(`/projects/${input.projectName}/screenplay`);
  await page.bringToFront();
  const dialog = page.getByRole('dialog', { name: 'Update screenplay?' });
  await expect(dialog).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();
  await expect(dialog.getByText(/Existing work for 35 Scene/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('long-review-1440x900.png') });
  await fs.writeFile(exportPath, fdx(scene('LATEST')));
  await expect(dialog.getByText('The screenplay changed again. Review the latest export.')).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('stale-review-1440x900.png') });
  await dialog.getByRole('button', { name: 'Review latest export' }).click();
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();

  const other = await context.newPage();
  await other.goto(`/projects/${input.projectName}/screenplay`);
  await other.bringToFront();
  const otherDialog = other.getByRole('dialog', { name: 'Update screenplay?' });
  await expect(otherDialog).toBeVisible({ timeout: 12000 });
  await expect(otherDialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();
  await otherDialog.getByRole('button', { name: 'Update screenplay', exact: true }).click();
  await expect(otherDialog).not.toBeVisible();
  await page.bringToFront();
  await expect(dialog.getByText('The screenplay changed again. Review the latest export.')).toBeVisible({ timeout: 12000 });
  const after = await service.readScreenplayStructure(input);
  expect(after.screenplay.scenes.map((row) => row.heading)).toEqual(['INT. LATEST - DAY']);
  await other.close();
  await dialog.getByRole('button', { name: 'Later' }).click();
  await expect(dialog).not.toBeVisible();
  await fs.writeFile(exportPath, '<FinalDraft>');
  await expect(dialog).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByRole('alert').filter({ hasText: /XML|parse|unclosed|unexpected|missing end tag/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('invalid-export-1440x900.png') });
  const revisionBeforeSourceOnly = await service.listScreenplayRevisions(input);
  await fs.writeFile(exportPath, fdx(scene('LATEST')).replace('<Content>', '<Content>\n'));
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/screenplay/fdx-update') && response.request().method() === 'GET'),
    dialog.getByRole('button', { name: 'Check for changes' }).click(),
  ]);
  await dialog.getByRole('button', { name: 'Review latest export' }).click();
  await expect(dialog.getByText('Only the source file changed. Screenplay content and production links stay the same.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Update screenplay', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('source-only-review-1440x900.png') });
  await dialog.getByRole('button', { name: 'Update screenplay', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await service.listScreenplayRevisions(input)).toEqual(revisionBeforeSourceOnly);
});
