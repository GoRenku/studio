import type {
  GenerationPreviewResource,
} from '@gorenku/studio-core/client';
import type { Locator, Page, Route } from '@playwright/test';
import { test, expect } from '../../fixtures/studio-e2e-test';

test.setTimeout(120_000);

test('preserves MediaCard collection and preview surfaces', async ({
  page,
  movieProject,
  generationPromptProject,
}) => {
  const browserMessages = collectBrowserWarnings(page);
  const shotPlanRoute =
    `/projects/${encodeURIComponent(movieProject.projectName)}` +
    `/scenes/${encodeURIComponent(movieProject.sceneId)}` +
    `?sceneTab=shotPlans&shotPlan=${encodeURIComponent(movieProject.shotPlanId)}` +
    `&shot=${encodeURIComponent(movieProject.firstShotId)}`;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(shotPlanRoute);
  await expect(
    page.getByRole('button', { name: 'Manage images for Shot 2' })
  ).toBeVisible();
  await screenshot(page, 'shot-rail-wide.png', []);

  await page.setViewportSize({ width: 1024, height: 900 });
  await screenshot(page, 'shot-rail-compact.png', []);

  const secondShotAction = page.getByRole('button', {
    name: 'Manage images for Shot 2',
  });
  await secondShotAction.click();
  await expect(
    page.getByRole('heading', { name: 'The crew absorbs the result' })
  ).toBeVisible();
  await screenshot(page, 'shot-candidate-collection.png', []);

  await page.keyboard.press('Escape');
  await expect(secondShotAction).toBeFocused();

  await openReferencePicker(
    page,
    referencePickerPreview(generationPromptProject.preview)
  );
  await screenshot(page, 'reference-picker.png', []);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.goto(
    `/projects/${encodeURIComponent(movieProject.projectName)}` +
    `/cast/${encodeURIComponent(movieProject.castMemberId)}`
  );
  await page.getByRole('tab', { name: 'Assets' }).click();
  await expect(
    page.getByRole('heading', { name: 'Character Sheets' })
  ).toBeVisible();
  const profilePreview = page.getByRole('button', { name: 'Urban profile' });
  await profilePreview.click();
  const galleryViewer = page.getByRole('dialog');
  await expect(galleryViewer.getByRole('img', { name: 'Urban profile' }))
    .toBeVisible();
  await screenshot(page, 'gallery-image-viewer.png', []);
  await galleryViewer.getByRole('button', {
    name: 'Close image preview',
  }).click();
  await expect(profilePreview).toBeFocused();
  await page.waitForLoadState('networkidle');
  expect(browserMessages).toEqual([]);
});

test('supports direct and nested Shot image preview without selecting', async ({
  page,
  movieProject,
}) => {
  const browserMessages = collectBrowserWarnings(page);
  const shotPlanRoute =
    `/projects/${encodeURIComponent(movieProject.projectName)}` +
    `/scenes/${encodeURIComponent(movieProject.sceneId)}` +
    `?sceneTab=shotPlans&shotPlan=${encodeURIComponent(movieProject.shotPlanId)}` +
    `&shot=${encodeURIComponent(movieProject.firstShotId)}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(shotPlanRoute);

  const firstShotAction = page.getByRole('button', {
    name: 'Manage images for Shot 1',
  });
  await firstShotAction.click();
  await expect(
    page.getByRole('img', {
      name: 'Image candidate 1 for Urban holds beside the cannon',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Use as selected image' })
  ).toHaveCount(0);
  await screenshot(page, 'shot-direct-image-viewer.png', []);
  await page.getByRole('button', { name: 'Close image preview' }).click();
  await expect(firstShotAction).toBeFocused();

  const secondShotAction = page.getByRole('button', {
    name: 'Manage images for Shot 2',
  });
  await secondShotAction.click();
  const collection = page.getByRole('dialog');
  const previewAction = collection.getByRole('button', {
    name: 'Preview Image candidate 2 for The crew absorbs the result',
  });
  const chooseAction = collection.getByRole('button', {
    name: 'Use as selected image',
  });
  await expect(chooseAction).toHaveAttribute('aria-pressed', 'false');
  await previewAction.click();
  await expect(page.locator('[role="dialog"]')).toHaveCount(2);
  const hiddenChooseAction = page.locator(
    'button[aria-label="Use as selected image"]'
  );
  await expect(hiddenChooseAction).toHaveAttribute('aria-pressed', 'false');
  await screenshot(page, 'shot-nested-image-viewer.png', []);
  await page.getByRole('button', { name: 'Close image preview' }).click();
  await expect(previewAction).toBeFocused();
  await expect(hiddenChooseAction).toHaveAttribute('aria-pressed', 'false');
  await page.waitForLoadState('networkidle');
  expect(browserMessages).toEqual([]);
});

test('preserves Shot candidate loading and error states', async ({
  page,
  movieProject,
}) => {
  const route = shotPlanRoute(movieProject);
  const assetRequest =
    /\/studio-api\/projects\/.*\/assets\?.*ownerKind=shot/;
  let releaseLoading: (() => void) | null = null;
  await page.route(assetRequest, async (request: Route) => {
    await new Promise<void>((resolve) => {
      releaseLoading = resolve;
    });
    await request.continue();
  });
  await page.goto(route);
  let action = page.getByRole('button', { name: 'Manage images for Shot 2' });
  await action.click();
  await expect(page.getByText('Loading Shot images...')).toBeVisible();
  await screenshot(page, 'shot-candidate-loading.png', []);
  releaseLoading?.();
  await page.keyboard.press('Escape');
  await page.unroute(assetRequest);

  await page.route(assetRequest, async (request) => {
    await request.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'E2E_SHOT_IMAGE_LOAD_FAILED',
          message: 'Unable to load Shot images for compatibility testing.',
        },
      }),
    });
  });
  await page.reload();
  action = page.getByRole('button', { name: 'Manage images for Shot 2' });
  await action.click();
  await expect(
    page.getByText('Unable to load Shot images for compatibility testing.')
  ).toBeVisible();
  await screenshot(page, 'shot-candidate-error.png', []);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

async function openReferencePicker(
  page: Page,
  preview: GenerationPreviewResource,
): Promise<void> {
  await page.goto(`/projects/${encodeURIComponent(preview.project.name)}`);
  await page.evaluate((resource) => {
    window.dispatchEvent(new CustomEvent('renku:generation-preview-requested', {
      detail: {
        projectName: resource.project.name,
        previews: [resource],
        eventId: `media-card-compat-${Date.now()}`,
        createdAt: '2026-07-28T10:00:00.000Z',
      },
    }));
  }, preview);
  await page.getByRole('tab', { name: 'References' }).click();
  const slot = preview.references.slots[0]!;
  await page.getByRole('button', {
    name: slot.current?.label ?? slot.eligibleCandidates[0]!.label,
    exact: true,
  }).click();
  await expect(
    page.getByRole('heading', { name: slot.label })
  ).toBeVisible();
}

function referencePickerPreview(
  source: GenerationPreviewResource,
): GenerationPreviewResource {
  const preview = structuredClone(source);
  const slot = preview.references.slots.find((candidate) => !candidate.locked);
  const candidates = [
    ...preview.references.additional,
    ...preview.references.slots.flatMap(
      (candidate) => candidate.eligibleCandidates
    ),
  ].filter(
    (candidate, index, all) =>
      all.findIndex((item) => referenceKey(item) === referenceKey(candidate)) ===
      index
  );
  if (!slot || candidates.length < 2) {
    throw new Error(
      'Reference Picker compatibility fixture needs one editable slot and two candidates.'
    );
  }
  slot.current = candidates[0]!;
  slot.eligibleCandidates = candidates.slice(0, 2);
  return preview;
}

function referenceKey(
  reference: GenerationPreviewResource['references']['additional'][number],
): string {
  return reference.identity.kind === 'asset-file'
    ? `${reference.identity.assetId}:${reference.identity.assetFileId}`
    : reference.browserUrl;
}

function shotPlanRoute(
  project: {
    projectName: string;
    sceneId: string;
    shotPlanId: string;
    firstShotId: string;
  },
): string {
  return (
    `/projects/${encodeURIComponent(project.projectName)}` +
    `/scenes/${encodeURIComponent(project.sceneId)}` +
    `?sceneTab=shotPlans&shotPlan=${encodeURIComponent(project.shotPlanId)}` +
    `&shot=${encodeURIComponent(project.firstShotId)}`
  );
}

function collectBrowserWarnings(page: Page): string[] {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      messages.push(message.text());
    }
  });
  return messages;
}

async function screenshot(
  page: Page,
  name: string,
  masks: Locator[],
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
    mask: masks,
  });
}
