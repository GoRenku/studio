import { expect, type Page } from '@playwright/test';
import type { StudioE2eShotVideoTakeProject } from '../fixtures/studio-e2e-project';
import { sceneRoute } from './scene-detail-page';

type SceneShotDetailTab =
  | 'description'
  | 'composition'
  | 'motion'
  | 'dialogs'
  | 'references'
  | 'ai-production';

export class TakeEditorPanel {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoTakeEditor(
    project: StudioE2eShotVideoTakeProject,
    input: { tab?: SceneShotDetailTab } = {}
  ): Promise<void> {
    const search = new URLSearchParams({
      sceneTab: 'takes',
      takeMode: 'edit',
      take: project.take.takeId,
      shot: project.firstShotId,
    });
    if (input.tab) {
      search.set('shotTab', input.tab);
    }
    await this.page.goto(`${sceneRoute(project)}?${search.toString()}`);
    await this.expectOpen();
  }

  async expectOpen(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'Shot 1 — Gate pressure' })
    ).toBeVisible();
  }

  async createPickAndDeleteNewTake(): Promise<void> {
    await this.page.getByLabel('Close take workspace').click();
    await this.page.getByRole('button', { name: 'New Take' }).click();
    await this.expectOpen();
    await this.page.getByLabel('Close take workspace').click();
    await expect(
      this.page.getByRole('button', { name: 'Gate pressure', exact: true })
    )
      .toHaveCount(2);

    const takeCards = this.page.getByRole('button', {
      name: 'Gate pressure',
      exact: true,
    });
    await takeCards.nth(1).hover();
    await this.page.getByLabel('Set Gate pressure pick').nth(1).click();
    await expect(this.page.getByLabel('Clear Gate pressure pick')).toBeVisible();
    await this.page.getByLabel('Clear Gate pressure pick').click();
    await expect(this.page.getByLabel('Set Gate pressure pick')).toHaveCount(2);
    await takeCards.nth(1).hover();
    await this.page.getByLabel('Set Gate pressure pick').nth(1).click();
    await expect(this.page.getByLabel('Clear Gate pressure pick')).toBeVisible();

    await takeCards.nth(1).hover();
    await this.page.getByLabel('Delete Gate pressure').nth(1).click();
    await expect(this.page.getByRole('dialog', { name: 'Delete Take?' }))
      .toBeVisible();
    await this.page.getByRole('button', { name: 'Delete' }).click();
    await expect(this.page.getByText('Take moved to Trash')).toBeVisible();
    await expect(
      this.page.getByRole('button', { name: 'Gate pressure', exact: true })
    )
      .toHaveCount(1);
  }
}
