import { MovieStudioPage } from '../../pages/movie-studio-page';
import { SceneDetailPage } from '../../pages/scene-detail-page';
import { expect, test } from '../../fixtures/studio-e2e-test';
import { studioE2eStructuredShotDescription } from '../../fixtures/studio-e2e-project';

test('opens act, sequence, and scene details with narrative content', async ({
  page,
  movieProject,
}) => {
  const movieStudio = new MovieStudioPage(page);
  const sceneDetail = new SceneDetailPage(page);

  await movieStudio.gotoAct(movieProject);
  await movieStudio.expectActVisible();

  await movieStudio.gotoSequence(movieProject);
  await movieStudio.expectSequenceVisible();

  await sceneDetail.gotoNarrative(movieProject);
  await sceneDetail.expectNarrativeVisible();
  await page
    .locator('[data-slot="tooltip-trigger"]')
    .filter({ hasText: 'Urban' })
    .hover();
  const narrativePreview = page.locator(
    '[data-slot="tooltip-content"][data-side] [data-screenplay-entity-preview-kind="castMember"]'
  ).first();
  await expect(
    narrativePreview.getByRole('img', { name: 'Urban profile image' })
  ).toBeVisible();
  await expect(narrativePreview).toHaveText('');
});

test('selects Scene Beats and navigates the Shot Plan rail', async ({
  page,
  movieProject,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const sceneRoute = `/projects/${encodeURIComponent(movieProject.projectName)}/scenes/${encodeURIComponent(movieProject.sceneId)}`;
  await page.goto(`${sceneRoute}?sceneTab=beats&beat=${movieProject.firstBeatId}`);
  await expect(page.getByText('Gate pressure', { exact: true }).first())
    .toBeVisible();
  await page.getByRole('button', { name: 'Beat 2 - Crew reaction' }).click();
  await expect(page).toHaveURL(
    `${sceneRoute}?sceneTab=beats&beat=${movieProject.secondBeatId}`
  );
  await expect(page.getByText('Show consequence through human response.'))
    .toBeVisible();

  await page.goto(`${sceneRoute}?sceneTab=shotPlans`);
  await page.getByRole('button', {
    name: 'Open Shot Plan Gate pressure coverage',
  }).click();
  await expect(
    page.getByRole('heading', { name: 'Urban holds beside the cannon' })
  ).toBeVisible();
  await expect(page.getByText('24mm lens')).toBeVisible();
  await expect(page.getByText('Deep Focus')).toBeVisible();
  await expect(page.getByText(/Focus on Urban/))
    .toBeVisible();
  await expect(page.getByText(/Focus on @Urban/)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Description' }).click();
  const descriptionEditor = page.getByRole('textbox', {
    name: 'Shot description',
  });
  await expect(descriptionEditor).toHaveAttribute('aria-readonly', 'true');
  await expect(
    descriptionEditor.locator('.cm-shot-description-mention')
  ).toHaveText(['@Urban', '@City Gate', '@Urban']);
  await descriptionEditor
    .locator('[data-screenplay-entity-mention-source="@urban"]')
    .first()
    .hover();
  await expect(
    page.locator(
      '.cm-shot-description-entity-preview [data-screenplay-entity-preview-kind="castMember"] img[alt="Urban profile image"]'
    )
  ).toBeVisible();
  await descriptionEditor
    .locator('[data-screenplay-entity-mention-source="@city-gate"]')
    .hover();
  await expect(
    page.locator(
      '.cm-shot-description-entity-preview [data-screenplay-entity-preview-kind="location"] img[alt="City Gate hero image"]'
    )
  ).toBeVisible();
  await descriptionEditor.focus();
  await descriptionEditor.press('ControlOrMeta+A');
  await descriptionEditor.press('ControlOrMeta+C');
  await expect.poll(
    () => page.evaluate(async () => navigator.clipboard.readText())
  ).toBe(studioE2eStructuredShotDescription);
  await page.getByRole('button', { name: 'Select Shot 2' }).click();
  await expect(page).toHaveURL(
    `${sceneRoute}?sceneTab=shotPlans&shotPlan=${movieProject.shotPlanId}&shot=${movieProject.secondShotId}`
  );
  await expect(
    page.getByRole('heading', { name: 'The crew absorbs the result' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to Shot Plans' }).click();
  await expect(page).toHaveURL(`${sceneRoute}?sceneTab=shotPlans`);
});
