import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/studio-e2e-test';
import { MovieStudioPage } from '../../pages/movie-studio-page';
import { SceneDetailPage } from '../../pages/scene-detail-page';
import { MediaSurfacePage } from '../../pages/media-surface-page';
import { VisualLanguagePage } from '../../pages/visual-language-page';

test('matches the locked desktop Studio experience across generation surfaces', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const scene = new SceneDetailPage(page);
  const media = new MediaSurfacePage(page);
  const visualLanguage = new VisualLanguagePage(page);

  await scene.gotoNarrative(shotVideoTakeProject);
  await screenshot(page, 'scene-narrative.png');

  await scene.openDialogueAudioPanel();
  await screenshot(page, 'scene-dialogue-audio.png');

  await movieStudio.gotoTakeEditor(shotVideoTakeProject, { tab: 'composition' });
  await movieStudio.expectSeededCompositionVisible();
  await screenshot(page, 'take-composition.png');

  await movieStudio.expectSeededMotionVisible();
  await screenshot(page, 'take-motion.png');

  await movieStudio.expectSeededDialogsVisible();
  await screenshot(page, 'take-dialogs.png', [
    page
      .getByText(/(?:audio references|dialogue reference selected)/)
      .first()
      .locator('..'),
  ]);

  await movieStudio.expectSeededReferencesVisible();
  await screenshot(page, 'take-references.png');

  await movieStudio.expectSeededAiProductionVisible();
  const modelTable = page.locator('table').filter({
    has: page.getByRole('columnheader', { name: 'Model' }),
  });
  await screenshot(page, 'take-ai-production.png', [modelTable.locator('..')]);

  await page.goto(
    `/projects/${encodeURIComponent(shotVideoTakeProject.projectName)}/scenes/${encodeURIComponent(shotVideoTakeProject.sceneId)}?sceneTab=takes`
  );
  await expect(page.getByText('New Take', { exact: true })).toBeVisible();
  await screenshot(page, 'scene-takes.png');

  await movieStudio.gotoCastMember(shotVideoTakeProject);
  await movieStudio.openCastAssetsTab();
  await screenshot(page, 'cast-assets.png');

  await media.gotoLocation(shotVideoTakeProject);
  await media.openLocationVisualContent();
  await screenshot(page, 'location-assets.png', [assetsTab(page)]);

  await visualLanguage.gotoLookbook(shotVideoTakeProject);
  await visualLanguage.expectLookbookDefinitionAndMedia();
  await screenshot(page, 'lookbook-assets.png', [assetsTab(page)]);
});

test('locks the three approved visible deltas in the DOM', async ({
  page,
  shotVideoTakeProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const media = new MediaSurfacePage(page);
  const visualLanguage = new VisualLanguagePage(page);

  await movieStudio.gotoTakeEditor(shotVideoTakeProject, { tab: 'ai-production' });
  await movieStudio.expectSeededAiProductionVisible();
  await expect(page.getByRole('columnheader')).toHaveText(['Model', 'Duration']);
  await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
  await expect(page.getByText('Input required', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(0);
  const modelTable = page.locator('table').filter({
    has: page.getByRole('columnheader', { name: 'Model' }),
  });
  await expect(modelTable.locator('tbody tr td:first-child')).toHaveText([
    'Seedance 2.0',
    'Seedance 2.0 Mini',
    'Seedance 2.0 Fast',
    'Kling V3 Standard 3.0',
    'Kling V3 Pro 3.0',
    'Kling O3 Standard O3',
    'Kling O3 Pro O3',
    'Veo 3.1',
    'XAI Grok Imagine Video 1.5',
    'LTX 3.2',
    'Alibaba Happy Horse',
  ]);
  await expect(modelTable.locator('tbody tr td:nth-child(2)')).toHaveText([
    '4-15s',
    '4-15s',
    '4-15s',
    '3-15s',
    '3-15s',
    '3-15s',
    '3-15s',
    '4, 6, 8s',
    '—',
    '6, 8, 10s',
    '3-15s',
  ]);
  const modelTableGeometry = await modelTable.evaluate((table) => {
    const wrapper = table.parentElement?.getBoundingClientRect();
    return {
      wrapper: wrapper
        ? { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height }
        : null,
      rowHeights: [...table.querySelectorAll('tbody tr')].map(
        (row) => row.getBoundingClientRect().height
      ),
    };
  });
  expect(modelTableGeometry.wrapper).not.toBeNull();
  expect(modelTableGeometry.wrapper?.x).toBeCloseTo(645.109375, 1);
  expect(modelTableGeometry.wrapper?.y).toBeCloseTo(423.265625, 1);
  expect(modelTableGeometry.wrapper?.width).toBeCloseTo(274.703125, 1);
  expect(modelTableGeometry.wrapper?.height).toBeCloseTo(162.734375, 1);
  expect(modelTableGeometry.rowHeights).toEqual([
    38.328125,
    38.328125,
    38.328125,
    38.328125,
    38.328125,
    38.328125,
    38.328125,
    38.328125,
    53,
    38.328125,
    38.328125,
  ]);

  await movieStudio.openShotDetailTab('references');
  await expect(page.getByText(/^\$\d/)).toHaveCount(0);

  await media.gotoLocation(shotVideoTakeProject);
  await expect(page.getByRole('tab', { name: 'Assets' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Visual Content' })).toHaveCount(0);

  await visualLanguage.gotoLookbook(shotVideoTakeProject);
  await expect(page.getByRole('tab', { name: 'Assets' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Visual Content' })).toHaveCount(0);
});

async function screenshot(
  page: Page,
  name: string,
  masks: Locator[] = []
): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete)
  );
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    mask: [page.getByText(/^E2E Shot Video Take /), ...masks],
  });
}

function assetsTab(page: Page): Locator {
  return page.getByRole('tab', { name: /^(Assets|Visual Content)$/ });
}
