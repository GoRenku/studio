import { expect, type Page } from '@playwright/test';
import type { StudioE2eMovieProject } from '../fixtures/studio-e2e-project';

export class SceneDetailPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoNarrative(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(sceneRoute(project));
    await this.expectNarrativeVisible();
  }

  async expectNarrativeVisible(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Ceremony Becomes Physics' })
    ).toBeVisible();
    await expect(this.page.getByText('Urban stands near the cannon')).toBeVisible();
    await expect(this.page.getByText('Hold the gate.')).toBeVisible();
  }

  async openDialogueAudioPanel(): Promise<void> {
    await this.page.getByRole('button', { name: 'Urban', exact: true }).click();
    await expect(
      this.page.getByRole('button', { name: 'Close dialogue audio panel' })
    ).toBeVisible();
  }

  async expectSimulatedDialogueAudioTakeVisible(): Promise<void> {
    await this.page
      .getByRole('complementary')
      .last()
      .getByRole('tab', { name: 'Takes' })
      .click();
    await expect(this.page.getByText('Take 1')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Play Take 1' }))
      .toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Delete Take 1' }))
      .toBeVisible();
  }

  async expectGeneratedDialogueAudioAvailable(): Promise<void> {
    await expect(
      this.page.getByLabel('Open dialogue audio takes')
    ).toBeVisible();
  }
}

export function sceneRoute(project: StudioE2eMovieProject): string {
  return `/projects/${encodeURIComponent(project.projectName)}/scenes/${encodeURIComponent(project.sceneId)}`;
}
