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
    await expect(
      this.projectCard(project).locator('xpath=ancestor::*[@data-media-card]')
    ).toContainText(project.projectName);
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

  async createEmptyProject(
    project: Pick<StudioE2eProject, 'title' | 'projectName' | 'projectPath'>
  ): Promise<void> {
    await this.page.getByRole('button', { name: 'Create Project' }).click();
    await this.page.getByLabel('Project title *').fill(project.title);
    await expect(this.page.getByLabel('Folder name *')).toHaveValue(
      project.projectName
    );
    await expect(this.page.getByText(project.projectPath, { exact: true }))
      .toBeVisible();
    await this.page.getByRole('button', { name: 'Create project' }).click();
    await expect(this.page).toHaveURL(
      new RegExp(
        `/projects/${escapeRegex(encodeURIComponent(project.projectName))}/?$`
      )
    );
  }

  async deleteProject(
    project: Pick<StudioE2eProject, 'title' | 'projectName'>
  ): Promise<void> {
    const card = this.projectCard(project).locator(
      'xpath=ancestor::*[@data-media-card]'
    );
    await card.hover();
    await card.getByRole('button', {
      name: `Delete ${project.projectName} Project`,
    }).click();

    const confirmationInput = this.page.getByLabel('Project name');
    const deleteButton = this.page.getByRole('button', {
      name: 'Delete Project',
    });
    await confirmationInput.fill(project.title);
    await expect(deleteButton).toBeDisabled();
    await confirmationInput.fill(project.projectName);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    await expect(this.projectCard(project)).toHaveCount(0);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
