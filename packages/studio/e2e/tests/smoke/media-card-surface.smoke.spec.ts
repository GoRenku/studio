import type { Locator } from '@playwright/test';
import { MovieStudioPage } from '../../pages/movie-studio-page';
import { expect, test } from '../../fixtures/studio-e2e-test';
import {
  importAdditionalCastProfileImage,
} from '../../fixtures/studio-e2e-project';

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

  await importAdditionalCastProfileImage({
    runtime: studioE2eRuntime,
    project: movieProject,
    relativePath: 'generated/media/urban-refreshed-profile.png',
    title: 'urban-refreshed-profile',
  });
  await movieStudio.publishCastAssetResourceChange(movieProject);
  await movieStudio.expectProfileImageVisible('Urban Refreshed Profile');
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
