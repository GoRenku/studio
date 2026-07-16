import { expect, type Page } from '@playwright/test';
import type { StudioE2eMovieProject } from '../fixtures/studio-e2e-project';

export class MediaSurfacePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoLocation(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/locations/${encodeURIComponent(project.locationId)}`
    );
    await expect(
      this.page
        .getByLabel('Details')
        .getByRole('heading', { name: 'City Gate' })
    ).toBeVisible();
  }

  async openLocationVisualContent(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Assets' }).click();
    await expect(
      this.page.getByRole('heading', { name: 'Location Sheets' })
    ).toBeVisible();
  }

  async previewLocationSheet(): Promise<void> {
    await this.page
      .getByRole('button', {
        name: 'The gate, approach, and defensive masonry.',
      })
      .click();
    await expect(
      this.page.getByRole('dialog', { name: /Gate Location Sheet/i })
    ).toBeVisible();
    await this.page.getByLabel('Close image preview').click();
  }

  async expectLocationSheetVisible(title: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: title })).toBeVisible();
  }

  async publishLocationResourceChange(
    project: StudioE2eMovieProject
  ): Promise<void> {
    await this.page.evaluate(
      ({ projectName, locationId }) => {
        window.dispatchEvent(
          new CustomEvent('renku:studio-resource-changed', {
            detail: {
              projectName,
              resourceKeys: [`assets:location:${locationId}`],
            },
          })
        );
      },
      {
        projectName: project.projectName,
        locationId: project.locationId,
      }
    );
  }

}
