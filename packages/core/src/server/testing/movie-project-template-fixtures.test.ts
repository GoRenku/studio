import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createBlankMovieProject,
  createSampleMovieProject,
  writeConfig,
} from './project-data-fixtures.js';

describe('movie project template fixtures', () => {
  it('creates isolated blank movie project folders and databases', async () => {
    const first = await createConfiguredProjectHome('renku-template-blank-first-');
    const second = await createConfiguredProjectHome('renku-template-blank-second-');
    const projectData = createProjectDataService();

    const firstProject = await createBlankMovieProject({
      homeDir: first.homeDir,
      projectData,
    });
    const secondProject = await createBlankMovieProject({
      homeDir: second.homeDir,
      projectData,
    });
    if (!firstProject || !secondProject) {
      return;
    }

    expect(firstProject.projectPath).toBe(path.join(first.storageRoot, 'blank-movie'));
    expect(secondProject.projectPath).toBe(path.join(second.storageRoot, 'blank-movie'));
    expect(firstProject.projectPath).not.toBe(secondProject.projectPath);
    expect(firstProject.databasePath).not.toBe(secondProject.databasePath);
    await expect(fs.access(firstProject.databasePath)).resolves.toBeUndefined();
    await expect(fs.access(secondProject.databasePath)).resolves.toBeUndefined();
  });

  it('keeps blank movie project mutation isolated between copies', async () => {
    const first = await createConfiguredProjectHome('renku-template-blank-mutation-a-');
    const second = await createConfiguredProjectHome('renku-template-blank-mutation-b-');
    const projectData = createProjectDataService();

    const firstProject = await createBlankMovieProject({
      homeDir: first.homeDir,
      projectData,
    });
    const secondProject = await createBlankMovieProject({
      homeDir: second.homeDir,
      projectData,
    });
    if (!firstProject || !secondProject) {
      return;
    }

    await projectData.openCurrentProject({
      homeDir: first.homeDir,
      projectName: 'blank-movie',
    });
    await projectData.applyCastOperations({
      homeDir: first.homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'isolated-cast',
              handle: 'isolated-cast',
              name: 'Isolated Cast',
              role: 'test role',
            },
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    const firstRead = await projectData.readProject({
      homeDir: first.homeDir,
      projectName: 'blank-movie',
    });
    const secondRead = await projectData.readProject({
      homeDir: second.homeDir,
      projectName: 'blank-movie',
    });

    expect(firstRead.counts.castMembers).toBe(1);
    expect(secondRead.counts.castMembers).toBe(0);
  });

  it('keeps blank movie project opening explicit', async () => {
    const fixture = await createConfiguredProjectHome('renku-template-blank-open-');
    const projectData = createProjectDataService();

    const created = await createBlankMovieProject({
      homeDir: fixture.homeDir,
      projectData,
    });
    if (!created) {
      return;
    }

    await expect(
      projectData.readCurrentProject({ homeDir: fixture.homeDir })
    ).resolves.toBeNull();
  });

  it('creates isolated sample movie project folders and databases', async () => {
    const first = await createConfiguredProjectHome('renku-template-sample-first-');
    const second = await createConfiguredProjectHome('renku-template-sample-second-');
    const projectData = createProjectDataService();

    const firstProject = await createSampleMovieProject({
      homeDir: first.homeDir,
      projectData,
    });
    const secondProject = await createSampleMovieProject({
      homeDir: second.homeDir,
      projectData,
    });
    if (!firstProject || !secondProject) {
      return;
    }

    expect(firstProject.projectPath).toBe(path.join(first.storageRoot, 'constantinople'));
    expect(secondProject.projectPath).toBe(path.join(second.storageRoot, 'constantinople'));
    expect(firstProject.projectPath).not.toBe(secondProject.projectPath);
    expect(firstProject.databasePath).not.toBe(secondProject.databasePath);
    await expect(fs.access(firstProject.databasePath)).resolves.toBeUndefined();
    await expect(fs.access(secondProject.databasePath)).resolves.toBeUndefined();
  });

  it('keeps sample movie project mutation isolated between copies', async () => {
    const first = await createConfiguredProjectHome('renku-template-sample-mutation-a-');
    const second = await createConfiguredProjectHome('renku-template-sample-mutation-b-');
    const projectData = createProjectDataService();

    const firstProject = await createSampleMovieProject({
      homeDir: first.homeDir,
      projectData,
    });
    const secondProject = await createSampleMovieProject({
      homeDir: second.homeDir,
      projectData,
    });
    if (!firstProject || !secondProject) {
      return;
    }

    await projectData.applyCastOperations({
      homeDir: first.homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'urban',
              handle: 'urban',
              name: 'Urban',
              role: 'cannon founder',
            },
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    const firstRead = await projectData.readProject({
      homeDir: first.homeDir,
      projectName: 'constantinople',
    });
    const secondRead = await projectData.readProject({
      homeDir: second.homeDir,
      projectName: 'constantinople',
    });

    expect(firstRead.cast.map((castMember) => castMember.handle)).toContain('urban');
    expect(secondRead.cast.map((castMember) => castMember.handle)).not.toContain('urban');
  });

  it('opens copied sample movie projects in the receiving home', async () => {
    const fixture = await createConfiguredProjectHome('renku-template-sample-open-');
    const projectData = createProjectDataService();

    const created = await createSampleMovieProject({
      homeDir: fixture.homeDir,
      projectData,
    });
    if (!created) {
      return;
    }

    await expect(
      projectData.readCurrentProject({ homeDir: fixture.homeDir })
    ).resolves.toMatchObject({
      projectName: 'constantinople',
      projectFolder: created.projectPath,
      databasePath: created.databasePath,
    });
  });

  it('fails fast when a template-backed fixture cannot resolve the home config', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-template-no-config-'));

    await expect(
      createBlankMovieProject({
        homeDir,
        projectData: createProjectDataService(),
      })
    ).rejects.toMatchObject({ code: 'CONFIG002' });
  });
});

async function createConfiguredProjectHome(
  prefix: string
): Promise<{ homeDir: string; storageRoot: string }> {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const storageRoot = path.join(homeDir, 'projects');
  await writeConfig(homeDir, storageRoot);
  return { homeDir, storageRoot };
}
