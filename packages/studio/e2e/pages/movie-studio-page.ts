import { expect, type Page } from '@playwright/test';
import type {
  StudioE2eMovieProject,
  StudioE2eProject,
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

  async gotoAct(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/acts/${encodeURIComponent(project.actId)}`
    );
  }

  async gotoSequence(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/sequences/${encodeURIComponent(project.sequenceId)}`
    );
  }

  async expectActVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'The Bombardment', exact: true })
    ).toBeVisible();
    await expect(this.page.getByText('1 scenes · 2 beats')).toBeVisible();
  }

  async expectSequenceVisible(): Promise<void> {
    await expect(this.page.getByText('Ceremony Becomes Physics').first())
      .toBeVisible();
    await expect(this.page.getByText('EXT / DAY')).toBeVisible();
  }

  async gotoCastMember(project: StudioE2eMovieProject): Promise<void> {
    await this.page.goto(
      `/projects/${encodeURIComponent(project.projectName)}/cast/${encodeURIComponent(project.castMemberId)}`
    );
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
    project: StudioE2eMovieProject
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
