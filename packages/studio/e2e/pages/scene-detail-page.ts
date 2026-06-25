import { expect, type Page } from '@playwright/test';
import type { StudioE2eShotVideoTakeProject } from '../fixtures/studio-e2e-project';

export class SceneDetailPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoNarrative(project: StudioE2eShotVideoTakeProject): Promise<void> {
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
    await expect(this.page.getByText('Picked')).toBeVisible();
  }

  async expectPickedDialogueAudioReferenceVisible(): Promise<void> {
    await expect(
      this.page.getByLabel('Play dialogue audio')
    ).toBeVisible();
  }
}

export function sceneRoute(project: StudioE2eShotVideoTakeProject): string {
  return `/projects/${encodeURIComponent(project.projectName)}/scenes/${encodeURIComponent(project.sceneId)}`;
}
