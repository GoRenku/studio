import { expect, type Page } from '@playwright/test';
import type { StudioE2eShotVideoTakeProject } from '../fixtures/studio-e2e-project';
import { sceneRoute } from './scene-detail-page';

export class SceneShotDetailPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoShots(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(`${sceneRoute(project)}?sceneTab=shots`);
    await this.expectFirstShotVisible();
  }

  async expectFirstShotVisible(): Promise<void> {
    const shotTab = this.page.getByRole('tabpanel', { name: 'Shots' });
    await expect(
      this.page.getByRole('button', { name: 'Gate pressure', exact: true })
    ).toBeVisible();
    await expect(shotTab.getByRole('heading', { name: 'Gate pressure', level: 2 }))
      .toBeVisible();
    await expect(this.page.getByText('The gate becomes the scene center.'))
      .toBeVisible();
  }

  async selectSecondShot(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Crew reaction', exact: true })
      .click();
    await expect(
      this.page
        .getByRole('tabpanel', { name: 'Shots' })
        .getByRole('heading', { name: 'Crew reaction', level: 2 })
    )
      .toBeVisible();
    await expect(
      this.page.getByText('The cannon crew absorbs the result.')
    ).toBeVisible();
  }
}
