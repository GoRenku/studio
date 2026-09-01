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
      this.page.getByRole('heading', { name: '1 - Ceremony Becomes Physics' })
    ).toBeVisible();
    await expect(
      this.page.getByRole('button', { name: /1 - Ceremony Becomes Physics/ })
    ).toBeVisible();
    await expect(this.page.getByText('Urban stands near the cannon')).toBeVisible();
    await expect(this.page.getByText('Hold the gate.')).toBeVisible();
    await expect(
      this.page.getByRole('group', { name: 'Dialogue by URBAN' })
        .locator('[data-dialogue-turn-number="1"]')
    ).toHaveText('1');
  }

  async gotoShotPlanAudio(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(shotPlanAudioRoute(project));
    await expect(this.page.getByRole('tab', { name: 'Audio' })).toHaveAttribute(
      'data-state',
      'active'
    );
  }

  async expectDialogueAudioTakeVisible(): Promise<void> {
    await expect(this.page.getByText('Turn 1', { exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Play Turn 1' }))
      .toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Select Turn 1 as audio context' }))
      .toBeVisible();
  }
}

export function sceneRoute(project: StudioE2eMovieProject): string {
  return `/projects/${encodeURIComponent(project.projectName)}/scenes/${encodeURIComponent(project.sceneId)}`;
}

export function shotPlanAudioRoute(project: StudioE2eMovieProject): string {
  return `${sceneRoute(project)}?sceneTab=shotPlans&shotPlan=${encodeURIComponent(project.shotPlanId)}&shotPlanTab=audio`;
}
