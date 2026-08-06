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
    settings.generation.renkuManaged.maxConcurrentGenerations = 4;
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

  it('rejects invalid replacement before changing the stored document', async () => {
    const fixture = await createFixture();
    await expect(
      fixture.service.replaceProjectSettings({
        projectName: fixture.projectName,
        homeDir: fixture.homeDir,
        settings: { ...DEFAULT_PROJECT_SETTINGS, version: 2 },
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
