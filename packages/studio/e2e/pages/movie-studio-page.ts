import { expect, type Page } from '@playwright/test';
import type {
  StudioE2eProject,
  StudioE2eShotVideoTakeProject,
} from '../fixtures/studio-e2e-project';

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

  async editProjectInformation(input: {
    title: string;
    logline: string;
    summary: string;
  }): Promise<void> {
    const projectName = decodeURIComponent(new URL(this.page.url()).pathname.split('/')[2] ?? '');
    await this.page.getByLabel('Title').fill(input.title);
    await this.page.getByLabel('Logline').fill(input.logline);
    await this.page.getByLabel('Summary').fill(input.summary);
    await expect
      .poll(
        async () =>
          await this.page.evaluate(async (name) => {
            const response = await fetch(
              `/studio-api/projects/${encodeURIComponent(name)}/information`
            );
            const body = (await response.json()) as {
              resource?: { title?: string };
            };
            return body.resource?.title ?? null;
          }, projectName),
        { timeout: 15_000 }
      )
      .toBe(input.title);
  }

  async expectProjectInformationValues(input: {
    title: string;
    logline: string;
    summary: string;
  }): Promise<void> {
    await expect(this.page.getByLabel('Title')).toHaveValue(input.title);
    await expect(this.page.getByLabel('Logline')).toHaveValue(input.logline);
    await expect(this.page.getByLabel('Summary')).toHaveValue(input.summary);
  }

  async gotoProject(project: StudioE2eProject): Promise<void> {
    await this.page.goto(`/projects/${encodeURIComponent(project.projectName)}`);
  }

  async gotoScene(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(sceneRoute(project));
  }

  async gotoAct(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/acts/${encodeURIComponent(project.actId)}`
    );
  }

  async gotoSequence(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/sequences/${encodeURIComponent(project.sequenceId)}`
    );
  }

  async expectActVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'The Bombardment', exact: true })
    ).toBeVisible();
    await expect(this.page.getByText('1 scenes · 2 shots')).toBeVisible();
  }

  async expectSequenceVisible(): Promise<void> {
    await expect(this.page.getByText('Ceremony Becomes Physics').first())
      .toBeVisible();
    await expect(this.page.getByText('EXT / DAY')).toBeVisible();
  }

  async gotoTakeEditor(
    project: StudioE2eShotVideoTakeProject,
    input: { shotId?: string; tab?: SceneShotDetailTab } = {}
  ): Promise<void> {
    await this.page.goto(takeEditorRoute(project, input));
  }

  async gotoCastMember(project: StudioE2eShotVideoTakeProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/cast/${encodeURIComponent(project.castMemberId)}`
    );
  }

  async expectSceneVisible(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Ceremony Becomes Physics' })
    ).toBeVisible();
  }

  async expectTakeEditorVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'Shot 1 — Gate pressure' })
    ).toBeVisible();
    await expect(
      this.page.getByRole('tab', { name: 'Composition' })
    ).toBeVisible();
  }

  async openShotDetailTab(tab: SceneShotDetailTab): Promise<void> {
    await this.page.getByRole('tab', { name: tabLabel(tab) }).click();
  }

  async expectSeededCompositionVisible(): Promise<void> {
    await this.openShotDetailTab('composition');
    await expect(
      this.page.getByRole('button', { name: 'Close-Up', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Single', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Low Angle', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Left', exact: true }).first()
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(this.page.getByLabel('Lens millimeters')).toHaveValue('85');
    await expect(
      this.page.getByPlaceholder('Custom composition...')
    ).toHaveValue('The gate fills the frame with severe pressure.');
  }

  async expectSeededMotionVisible(): Promise<void> {
    await this.openShotDetailTab('motion');
    await expect(
      this.page.getByRole('button', { name: 'Push In', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Forward', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Straight', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByRole('button', { name: 'Dolly', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(this.page.getByPlaceholder('Custom motion…')).toHaveValue(
      'A slow push tightens the pressure on the gate.'
    );
  }

  async expectSeededReferencesVisible(): Promise<void> {
    await this.openShotDetailTab('references');
    await expect(
      this.page.getByRole('button', {
        name: 'Imperial Wound Sheet',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      this.page.getByRole('button', {
        name: 'Urban',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      this.page.getByRole('button', {
        name: 'Gate Location Sheet',
        exact: true,
      })
    ).toBeVisible();
  }

  async expectSeededDialogsVisible(): Promise<void> {
    await this.openShotDetailTab('dialogs');
    await expect(this.page.getByText('Hold the gate.')).toBeVisible();
    await expect(this.page.getByText('Urban', { exact: true })).toBeVisible();
  }

  async expectSeededAiProductionVisible(): Promise<void> {
    await this.openShotDetailTab('ai-production');
    await expect(
      this.page.getByRole('button', { name: 'Text only', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      this.page.getByText('Seedance 2.0', { exact: true }).first()
    ).toBeVisible();
  }

  async closeTakeWorkspace(): Promise<void> {
    await this.page.getByLabel('Close take workspace').click();
  }

  async openTakeCard(title: string): Promise<void> {
    await this.page.getByRole('button', { name: title, exact: true }).click();
    await this.expectTakeEditorVisible();
  }

  async selectFirstShot(): Promise<void> {
    await this.page.getByRole('button', { name: 'Shot 1 — Gate pressure' }).click();
  }

  async addSecondShotToCurrentTake(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Expand Select for Shot 2' })
      .click({ force: true });
    await this.page.getByRole('button', { name: 'Edit Mode' }).click();
    await expect(
      this.page.getByRole('dialog', { name: 'Edit Mode' })
    ).toBeVisible();
    await this.page.getByRole('button', { name: 'Apply' }).click();
    await expect(
      this.page.getByRole('dialog', { name: 'Edit Mode' })
    ).toBeHidden();
    await this.page
      .getByRole('button', { name: 'Shot 2 — Crew reaction' })
      .click();
  }

  async expectCurrentTakeIncludesTwoShots(): Promise<void> {
    await expect(this.page.getByText('2 shots')).toBeVisible();
    await expect(
      this.page.getByRole('button', { name: 'Shot 2 — Crew reaction' })
    ).toBeVisible();
  }

  async openCastAssetsTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Assets' }).click();
    await expect(
      this.page.getByRole('heading', { name: 'Profile Images' })
    ).toBeVisible();
  }

  async openProfileImagePreview(input: {
    cardName: string;
    dialogName: string;
  }): Promise<void> {
    await this.page.getByRole('button', { name: input.cardName }).click();
    await expect(
      this.page.getByRole('dialog', { name: input.dialogName })
    ).toBeVisible();
    await this.page.getByLabel('Close image preview').click();
    await expect(
      this.page.getByRole('dialog', { name: input.dialogName })
    ).toBeHidden();
  }

  async clearProfileImagePick(): Promise<void> {
    await this.page.getByLabel('Clear profile image pick').click();
    await expect(this.page.getByLabel('Set profile image pick')).toBeVisible();
  }

  async expectProfileImageVisible(title: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: title })).toBeVisible();
  }

  async publishCastAssetResourceChange(
    project: StudioE2eShotVideoTakeProject
  ): Promise<void> {
    await this.page.evaluate(
      ({ projectName, castMemberId }) => {
        window.dispatchEvent(
          new CustomEvent('renku:studio-resource-changed', {
            detail: {
              projectName,
              resourceKeys: [`assets:castMember:${castMemberId}`],
            },
          })
        );
      },
      {
        projectName: project.projectName,
        castMemberId: project.castMemberId,
      }
    );
  }
}

type SceneShotDetailTab =
  | 'description'
  | 'composition'
  | 'motion'
  | 'dialogs'
  | 'references'
  | 'ai-production';

function sceneRoute(project: StudioE2eShotVideoTakeProject): string {
  return `/projects/${encodeURIComponent(project.projectName)}/scenes/${encodeURIComponent(project.sceneId)}`;
}

function takeEditorRoute(
  project: StudioE2eShotVideoTakeProject,
  input: { shotId?: string; tab?: SceneShotDetailTab } = {}
): string {
  const search = new URLSearchParams({
    sceneTab: 'takes',
    takeMode: 'edit',
    take: project.take.takeId,
    shot: input.shotId ?? project.firstShotId,
  });
  if (input.tab) {
    search.set('shotTab', input.tab);
  }
  return `${sceneRoute(project)}?${search.toString()}`;
}

function tabLabel(tab: SceneShotDetailTab): string {
  switch (tab) {
    case 'ai-production':
      return 'AI Production';
    default:
      return tab.charAt(0).toUpperCase() + tab.slice(1);
  }
}
