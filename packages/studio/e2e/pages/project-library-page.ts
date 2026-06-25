import { expect, type Page } from '@playwright/test';
import type { StudioE2eProject } from '../fixtures/studio-e2e-project';

export class ProjectLibraryPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(
      this.page.getByRole('heading', { name: 'Project Library' })
    ).toBeVisible();
  }

  projectCard(project: Pick<StudioE2eProject, 'title' | 'projectName'>) {
    return this.page.getByRole('button', {
      name: new RegExp(escapeRegex(project.title)),
    });
  }

  async expectProjectVisible(
    project: Pick<StudioE2eProject, 'title' | 'projectName'>
  ): Promise<void> {
    await expect(this.projectCard(project)).toBeVisible();
    await expect(this.projectCard(project)).toContainText(project.projectName);
  }

  async openProject(
    project: Pick<StudioE2eProject, 'title' | 'projectName'>
  ): Promise<void> {
    await this.projectCard(project).click();
    await expect(this.page).toHaveURL(
      new RegExp(
        `/projects/${escapeRegex(encodeURIComponent(project.projectName))}/?$`
      )
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
