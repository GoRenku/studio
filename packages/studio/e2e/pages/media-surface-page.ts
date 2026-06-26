import { expect, type Page } from '@playwright/test';
import type { StudioE2eShotVideoTakeProject } from '../fixtures/studio-e2e-project';

export class MediaSurfacePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoLocation(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/locations/${encodeURIComponent(project.locationId)}`
    );
    await expect(
      this.page.getByRole('heading', { name: 'City Gate' })
    ).toBeVisible();
  }

  async openLocationVisualContent(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Visual Content' }).click();
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
    project: StudioE2eShotVideoTakeProject
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

  async gotoTrash(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/trash`
    );
    await expect(this.page.getByRole('button', { name: 'Empty' })).toBeVisible();
  }

  async expectDiscardedTakeVisible(
    title = 'Trash restore candidate'
  ): Promise<void> {
    await expect(this.page.getByText(title)).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Restore', exact: true }))
      .toBeVisible();
    await expect(
      this.page.getByRole('button', { name: 'Empty', exact: true })
    ).toBeEnabled();
  }

  async restoreDiscardedTake(title = 'Trash restore candidate'): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/trash/restore') &&
        response.request().method() === 'POST'
    );

    await this.page.getByRole('button', { name: 'Restore', exact: true }).click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    await expect(this.page.getByText(title)).toBeHidden();
    await expect(this.page.getByText('Trash is empty.')).toBeVisible();
  }

  async emptyTrash(): Promise<void> {
    await this.page.getByRole('button', { name: 'Empty', exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Empty Trash?' });
    await expect(dialog).toBeVisible();

    const previewResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/trash/empty/preview') &&
        response.request().method() === 'POST'
    );
    const runResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/trash/empty/run') &&
        response.request().method() === 'POST'
    );

    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    const previewResponse = await previewResponsePromise;
    const runResponse = await runResponsePromise;
    expect(previewResponse.ok()).toBeTruthy();
    expect(runResponse.ok()).toBeTruthy();
    await expect(this.page.getByText('Trash restore candidate')).toBeHidden();
    await expect(this.page.getByText('Trash is empty.')).toBeVisible();
  }
}
