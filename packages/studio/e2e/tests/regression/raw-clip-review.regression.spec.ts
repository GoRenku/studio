import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { expect, test } from '../../fixtures/studio-e2e-test';

test.use({ viewport: { width: 1440, height: 1000 } });

test('reviews raw clip boundaries, alternatives, source attribution and independent transports', async ({ page, movieProject, studioE2eRuntime }, testInfo) => {
  const service = createProjectDataService();
  const project = { homeDir: studioE2eRuntime.isolatedHomeDirectory, projectName: movieProject.projectName };
  const plan = await service.createShotPlan({ ...project, sceneId: movieProject.sceneId, type: 'previs', title: 'Raw clip review', coverage: null, shots: [] });
  const scope = { ...project, shotPlanId: plan.shotPlan.id };
  const sourceDirectory = (await service.readShotPlanPrevis(scope)).sourceDirectory;
  await fs.mkdir(path.join(movieProject.projectPath, sourceDirectory), { recursive: true });
  await fs.writeFile(path.join(movieProject.projectPath, sourceDirectory, 'scene.blend'), 'Fixture source envelope');
  await fs.writeFile(path.join(movieProject.projectPath, sourceDirectory, 'description.md'), 'A quiet room. The visitor enters and takes a seat.');
  for (const duration of [2, 3, 4]) {
    await fs.copyFile(new URL(`../../fixtures/raw-clips/${duration}s.webm`, import.meta.url), path.join(movieProject.projectPath, `${duration}s.webm`));
  }
  await fs.copyFile(new URL('../../fixtures/raw-clips/previs.mp4', import.meta.url), path.join(movieProject.projectPath, 'previs.mp4'));
  const revision = (await service.registerShotPlanPrevis({ ...scope, sourceDirectory, renderPath: 'previs.mp4' })).revisions[0]!;
  const revisionScope = { ...scope, previsRevisionId: revision.id };
  let sourceTakeId: string | undefined;
  for (const duration of [2, 3, 4]) {
    const clip = (await service.createShotPlanClip(revisionScope)).clips.at(-1)!;
    await service.attachGenerationMedia({ ...project, purpose: 'shot-plan.video-generation', target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: `${duration}s.webm`, clipId: clip.id, takeTitle: duration === 2 ? 'Initial' : undefined, sourceTakeId,
      generationProvenance: { provider: 'fixture', model: 'video', mediaKind: 'video', prompt: null, request: {} } });
    const take = (await service.readShotPlanClips(revisionScope)).clips.at(-1)!.takes[0]!;
    await service.selectShotPlanClipTake({ ...project, clipId: clip.id, takeId: take.id });
    sourceTakeId = take.id;
  }
  const clips = (await service.readShotPlanClips(revisionScope)).clips;
  await service.attachGenerationMedia({ ...project, purpose: 'shot-plan.video-generation', target: { kind: 'shotPlan', id: plan.shotPlan.id },
    sourceProjectRelativePath: '3s.webm', clipId: clips[0]!.id, takeTitle: 'Corrected speakers and drawing',
    generationProvenance: { provider: 'fixture', model: 'video', mediaKind: 'video', prompt: null, request: {} } });
  await page.goto(`/projects/${movieProject.projectName}/scenes/${movieProject.sceneId}?sceneTab=shotPlans&shotPlan=${plan.shotPlan.id}`);
  const left = page.getByTitle('Previs', { exact: true });
  const right = page.getByTitle('Generation', { exact: true });
  await expect(page.getByRole('slider', { name: 'Generation timeline', exact: true })).toHaveAttribute('aria-valuemax', '12');
  await expect(page.getByRole('button', { name: 'Link playback', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Play Generation', exact: true }).click();
  await expect.poll(() => right.getAttribute('src')).toContain(clips[1]!.takes[0]!.assetFileId);
  expect(await left.evaluate((video: HTMLVideoElement) => video.currentTime)).toBe(0);
  await page.getByRole('button', { name: 'Pause Generation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Generation take', exact: true }).click();
  await page.getByRole('option', { name: 'Clip 1.2: Corrected speakers and drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use this take', exact: true })).toBeVisible();
  expect((await service.readShotPlanClips(revisionScope)).clips[0]!.selectedTakeId).toBe(clips[0]!.selectedTakeId);
  await page.getByRole('button', { name: 'Use this take', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Generation timeline', exact: true })).toHaveAttribute('aria-valuemax', '12');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Generation take', exact: true })).toContainText('Clip 1.2');
  await page.getByRole('combobox', { name: 'Generation take', exact: true }).click();
  await page.getByRole('option', { name: 'Clip 2.1', exact: true }).click();
  await page.getByRole('button', { name: 'Back to clips', exact: true }).click();
  await page.getByRole('button', { name: 'Source take', exact: true }).hover();
  await expect(page.getByText('Source: Clip 1.1; selected: Clip 1.2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Link playback', exact: true }).click();
  await expect.poll(() => left.evaluate((video: HTMLVideoElement) => video.currentTime)).toBe(3);
  await page.getByRole('slider', { name: 'Previs timeline', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Link playback', exact: true }).click();
  const darkTheme = page.getByRole('switch', { name: 'Switch to dark mode' });
  if (await darkTheme.count()) await darkTheme.click();
  await page.getByRole('button', { name: 'Link playback', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Link');
  await page.mouse.move(0, 0);
  await page.screenshot({ path: testInfo.outputPath('raw-clips-dark.png'), fullPage: true });
  const theme = page.getByRole('switch', { name: 'Switch to light mode' });
  if (await theme.count()) await theme.click();
  await page.screenshot({ path: testInfo.outputPath('raw-clips-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Enter fullscreen: Generation' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play shot', exact: true }).click();
  await expect.poll(() => right.getAttribute('src')).toContain(clips[2]!.takes[0]!.assetFileId);
  expect(await page.evaluate(() => document.fullscreenElement?.contains(document.querySelector('video[title="Generation"]')))).toBe(true);
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause shot', exact: true }).click();
  await page.keyboard.press('Escape');
  await service.selectShotPlanClipTake({ ...project, clipId: clips[1]!.id, takeId: null });
  await page.reload();
  await expect(page.getByText('No clips assigned', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Generation timeline', exact: true })).toHaveAttribute('aria-valuemax', '12');
  await page.getByRole('combobox', { name: 'Generation take', exact: true }).click();
  await page.getByRole('option', { name: 'Clip 3.1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to clips', exact: true })).toBeVisible();
});
