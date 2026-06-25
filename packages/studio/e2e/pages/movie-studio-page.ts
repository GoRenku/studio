import { expect, type Page } from '@playwright/test';
import type { StudioE2eProject } from '../fixtures/studio-e2e-project';

export class MovieStudioPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectProjectInformationVisible(project: StudioE2eProject): Promise<void> {
    await expect(this.page.getByLabel('Project Name')).toHaveValue(
      project.projectName
    );
    await expect(this.page.getByLabel('Title')).toHaveValue(project.title);
  }
}
