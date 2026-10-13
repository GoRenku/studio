import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createProjectDataService } from '../project-data-service.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { projectSettings } from '../schema/index.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { DEFAULT_PROJECT_SETTINGS } from './document.js';

describe('Project Settings service', () => {
  it('creates, reads, and replaces one complete Project Settings document', async () => {
    const fixture = await createFixture();
    const initial = await fixture.service.readProjectSettings({
      projectName: fixture.projectName,
      homeDir: fixture.homeDir,
    });
    expect(initial.settings).toEqual(DEFAULT_PROJECT_SETTINGS);

    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.screenplayImport.runScreenplayAnalysis = true;
    settings.generation.video.maxConcurrentGenerations = 4;
    const report = await fixture.service.replaceProjectSettings({
      projectName: fixture.projectName,
      homeDir: fixture.homeDir,
      settings,
    });

    expect(report).toEqual({
      resource: {
        project: {
          id: expect.any(String),
          name: fixture.projectName,
        },
        settings,
      },
      resourceKeys: ['project-settings'],
    });
    await expect(
      fixture.service.readProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
      })
    ).resolves.toMatchObject({ settings });
  });

  it('updates one generation lane and clears its model when the provider changes', async () => {
    const fixture = await createFixture();
    const target = { projectName: fixture.projectName, homeDir: fixture.homeDir };
    const modelled = await fixture.service.updateGenerationLaneSettings({
      ...target,
      lane: 'imageEdit',
      model: { key: 'fictional-edit', name: 'Fictional Edit' },
      chooseRouteBeforeGenerating: false,
    });
    expect(modelled.resourceKeys).toEqual(['project-settings']);
    expect(modelled.resource.settings.generation.imageEdit).toEqual({
      ...DEFAULT_PROJECT_SETTINGS.generation.imageEdit,
      model: { key: 'fictional-edit', name: 'Fictional Edit' },
      chooseRouteBeforeGenerating: false,
    });
    expect(modelled.resource.settings.generation.image).toEqual(DEFAULT_PROJECT_SETTINGS.generation.image);

    const switched = await fixture.service.updateGenerationLaneSettings({
      ...target,
      lane: 'imageEdit',
      provider: 'fictional-provider',
    });
    expect(switched.resource.settings.generation.imageEdit).toMatchObject({
      provider: 'fictional-provider',
      model: null,
      chooseRouteBeforeGenerating: false,
    });

    const named = await fixture.service.updateGenerationLaneSettings({
      ...target,
      lane: 'imageEdit',
      provider: 'fal-ai',
      model: { key: 'fictional-edit', name: 'Fictional Edit' },
    });
    expect(named.resource.settings.generation.imageEdit.model).toEqual({ key: 'fictional-edit', name: 'Fictional Edit' });
  });

  it.each([
    ['an unknown lane', { lane: 'imageEditing' as 'imageEdit', askBeforeGenerating: false }],
    ['an empty change', { lane: 'video' as const }],
  ])('rejects %s without writing', async (_name, change) => {
    const fixture = await createFixture();
    const target = { projectName: fixture.projectName, homeDir: fixture.homeDir };
    await expect(fixture.service.updateGenerationLaneSettings({ ...target, ...change }))
      .rejects.toMatchObject({ code: 'PROJECT_SETTINGS003' });
    await expect(fixture.service.readProjectSettings(target))
      .resolves.toMatchObject({ settings: DEFAULT_PROJECT_SETTINGS });
  });

  it('rejects an invalid lane value through the document contract', async () => {
    const fixture = await createFixture();
    await expect(fixture.service.updateGenerationLaneSettings({
      projectName: fixture.projectName,
      homeDir: fixture.homeDir,
      lane: 'audio',
      provider: 'Not Kebab',
    })).rejects.toMatchObject({ code: 'PROJECT_SETTINGS002' });
  });

  it('rejects invalid replacement before changing the stored document', async () => {
    const fixture = await createFixture();
    await expect(
      fixture.service.replaceProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
        settings: { ...DEFAULT_PROJECT_SETTINGS, version: 8 as 7 },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_SETTINGS002' });
    await expect(
      fixture.service.readProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
      })
    ).resolves.toMatchObject({ settings: DEFAULT_PROJECT_SETTINGS });
  });

  it('fails after reading invalid stored JSON', async () => {
    const fixture = await createFixture();
    const session = openProjectStore({
      projectFolder: fixture.projectPath,
      create: false,
    });
    try {
      session.db
        .update(projectSettings)
        .set({ document: '{' })
        .where(eq(projectSettings.singletonId, 1))
        .run();
    } finally {
      session.close();
    }
    await expect(
      fixture.service.readProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_SETTINGS002' });
  });

  it('fails when the required singleton is missing', async () => {
    const fixture = await createFixture();
    const session = openProjectStore({
      projectFolder: fixture.projectPath,
      create: false,
    });
    try {
      session.db.delete(projectSettings).run();
    } finally {
      session.close();
    }
    await expect(
      fixture.service.readProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_SETTINGS001' });
  });
});

async function createFixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-project-settings-'));
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const service = createProjectDataService();
  const projectName = 'settings-movie';
  const created = await createBlankMovieProject({
    projectData: service,
    homeDir,
    projectName,
    title: 'Settings Movie',
  });
  if (!created) {
    throw new Error('Project fixture was not created.');
  }
  return { homeDir, service, projectName, projectPath: created.projectPath };
}
