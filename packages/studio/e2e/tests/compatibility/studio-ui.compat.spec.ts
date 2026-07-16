import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/studio-e2e-test';
import { MovieStudioPage } from '../../pages/movie-studio-page';
import { SceneDetailPage } from '../../pages/scene-detail-page';
import { MediaSurfacePage } from '../../pages/media-surface-page';
import { VisualLanguagePage } from '../../pages/visual-language-page';

test('matches the locked desktop Studio experience across current surfaces', async ({
  page,
  movieProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const scene = new SceneDetailPage(page);
  const media = new MediaSurfacePage(page);
  const visualLanguage = new VisualLanguagePage(page);
  const sceneRoute = `/projects/${encodeURIComponent(movieProject.projectName)}/scenes/${encodeURIComponent(movieProject.sceneId)}`;

  await scene.gotoNarrative(movieProject);
  await screenshot(page, 'scene-narrative.png');

  await scene.openDialogueAudioPanel();
  await screenshot(page, 'scene-dialogue-audio.png');

  await page.goto(
    `${sceneRoute}?sceneTab=beats&beat=${movieProject.firstBeatId}`
  );
  await expect(page.getByText('Gate pressure', { exact: true }).first())
    .toBeVisible();
  await screenshot(page, 'scene-beats.png');

  await page.goto(`${sceneRoute}?sceneTab=shots`);
  await expect(page.getByRole('button', { name: 'New Shot' })).toBeVisible();
  await screenshot(page, 'scene-shots-placeholder.png');

  await movieStudio.gotoCastMember(movieProject);
  await movieStudio.openCastAssetsTab();
  await screenshot(page, 'cast-assets.png');

  await media.gotoLocation(movieProject);
  await media.openLocationVisualContent();
  await screenshot(page, 'location-assets.png', [assetsTab(page)]);

  await visualLanguage.gotoLookbook(movieProject);
  await visualLanguage.expectLookbookDefinitionAndMedia();
  await screenshot(page, 'lookbook-assets.png', [assetsTab(page)]);
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
    mask: [page.getByText(/^E2E Beat Sheet /), ...masks],
  });
}

function assetsTab(page: Page): Locator {
  return page.getByRole('tab', { name: /^(Assets|Visual Content)$/ });
}
