import type { Locator } from '@playwright/test';
import { MovieStudioPage } from '../../pages/movie-studio-page';
import { expect, test } from '../../fixtures/studio-e2e-test';
import {
  writeStudioE2eImageSource,
} from '../../fixtures/studio-e2e-project';
import { runStudioE2eMediaImport } from '../../fixtures/studio-e2e-cli';

test('opens media preview, updates profile pick, and refreshes after resource change', async ({
  page,
  movieProject,
  studioE2eRuntime,
}) => {
  const movieStudio = new MovieStudioPage(page);

  await movieStudio.gotoCastMember(movieProject);
  await movieStudio.openCastAssetsTab();

  const profileCard = page
    .getByRole('button', { name: 'Urban Profile' })
    .locator('xpath=ancestor::*[@data-media-card]');
  const selectionControl = profileCard.getByLabel('Clear profile image pick');
  const deleteControl = profileCard.getByLabel('Delete image');
  await expect(profileCard.locator('button button')).toHaveCount(0);
  await expectControlInCorner({
    card: profileCard,
    control: selectionControl,
    horizontal: 'right',
    vertical: 'bottom',
  });
  await profileCard.hover();
  await expectControlInCorner({
    card: profileCard,
    control: deleteControl,
    horizontal: 'right',
    vertical: 'top',
  });
  await deleteControl.click();
  await expect(page.getByRole('dialog', { name: 'Delete Image?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await movieStudio.openProfileImagePreview({
    cardName: 'Urban Profile',
    dialogName: 'Urban profile',
  });
  await movieStudio.clearProfileImagePick();
  await page.getByLabel('Set profile image pick').click();
  await expect(page.getByLabel('Clear profile image pick')).toBeVisible();

  const source = 'generated/media/urban-refreshed-profile.png';
  await writeStudioE2eImageSource({
    runtime: studioE2eRuntime,
    project: movieProject,
    relativePath: source,
  });
  const refreshed = movieStudio.waitForResourcePoll(
    `surface:castMember:${movieProject.castMemberId}`
  );
  await runStudioE2eMediaImport({
    runtime: studioE2eRuntime,
    projectName: movieProject.projectName,
    purpose: 'cast.profile',
    target: `cast:${movieProject.castMemberId}`,
    source,
    title: 'Urban Refreshed Profile',
  });
  await refreshed;
  await movieStudio.expectProfileImageVisible('profile image');
});

async function expectControlInCorner(input: {
  card: Locator;
  control: Locator;
  horizontal: 'left' | 'right';
  vertical: 'top' | 'bottom';
}): Promise<void> {
  const cardBox = await input.card.boundingBox();
  const controlBox = await input.control.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(controlBox).not.toBeNull();
  if (!cardBox || !controlBox) return;

  const controlCenterX = controlBox.x + controlBox.width / 2;
  const controlCenterY = controlBox.y + controlBox.height / 2;
  const cardCenterX = cardBox.x + cardBox.width / 2;
  const cardCenterY = cardBox.y + cardBox.height / 2;

  expect(
    input.horizontal === 'right'
      ? controlCenterX > cardCenterX
      : controlCenterX < cardCenterX
  ).toBe(true);
  expect(
    input.vertical === 'bottom'
      ? controlCenterY > cardCenterY
      : controlCenterY < cardCenterY
  ).toBe(true);
}
