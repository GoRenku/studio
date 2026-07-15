import { expect, type Page } from '@playwright/test';
import type { StudioE2eShotVideoTakeProject } from '../fixtures/studio-e2e-project';

export class VisualLanguagePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoInspiration(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/visual-language/inspiration`
    );
    await expect(
      this.page.getByRole('button', { name: 'Create Inspiration folder' })
    ).toBeVisible();
  }

  async createFolder(name: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Inspiration folder' }).click();
    await this.page.getByPlaceholder('Blade Runner 2049').fill(name);
    await this.page.getByRole('button', { name: 'Create' }).click();
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
    await expect(
      this.page.getByRole('region', { name: 'Inspiration grabs drop target' })
    ).toBeVisible();
  }

  async uploadPreviewAndDeleteImage(filePath: string): Promise<void> {
    await this.page.locator('input[type="file"]').setInputFiles(filePath);
    const imageButton = this.page.getByRole('button', {
      name: 'inspiration-fixture.png inspiration grab',
      exact: true,
    });
    await expect(
      imageButton
    ).toBeVisible();
    await imageButton.click();
    await expect(
      this.page.getByRole('dialog', { name: /inspiration-fixture/i })
    ).toBeVisible();
    await this.page.getByLabel('Close image preview').click();
    await this.page.getByLabel(/Delete inspiration-fixture/i).click();
    await this.page.getByRole('button', { name: 'Delete' }).click();
    await expect(
      imageButton
    ).toBeHidden();
  }

  async gotoLookbook(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/visual-language/lookbooks/production`
    );
    await expect(
      this.page.getByRole('heading', { name: 'Imperial Wound' })
    ).toBeVisible();
  }

  async expectLookbookDefinitionAndMedia(): Promise<void> {
    await expect(this.page.getByText('The movie should feel rigorous and tense.'))
      .toBeVisible();
    await this.page.getByRole('tab', { name: 'Assets' }).click();
    await expect(
      this.page.getByRole('heading', { name: 'Lookbook Sheets' })
    ).toBeVisible();
    await expect(this.page.getByText('1 image', { exact: true })).toBeVisible();
  }

  async expectProductionExportCommandVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'Export production assets' })
    ).toBeEnabled();
  }
}
