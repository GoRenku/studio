import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { writeConfig } from '../testing/project-data-fixtures.js';

describe('Studio project reference resolution', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'renku-studio-project-ref-test-'))
    );
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('uses the current project unless an explicit project name overrides it', async () => {
    const projectData = createProjectDataService();
    await projectData.createMovieProject({
      homeDir,
      projectName: 'current-movie',
      title: 'Current Movie',
    });
    await projectData.createMovieProject({
      homeDir,
      projectName: 'other-movie',
      title: 'Other Movie',
    });
    await projectData.openCurrentProject({ homeDir, projectName: 'current-movie' });
    const currentProject = await projectData.readProject({
      homeDir,
      projectName: 'current-movie',
    });
    const otherProject = await projectData.readProject({
      homeDir,
      projectName: 'other-movie',
    });

    await expect(projectData.resolveStudioProjectRef({ homeDir })).resolves.toEqual({
      name: 'current-movie',
      id: currentProject.identity.id,
      storageRoot,
    });
    await expect(projectData.resolveStudioProjectRef({
      homeDir,
      projectName: 'other-movie',
    })).resolves.toEqual({
      name: 'other-movie',
      id: otherProject.identity.id,
      storageRoot,
    });
  });

  it('fails with the current-project diagnostic when no project is open', async () => {
    await expect(
      createProjectDataService().resolveStudioProjectRef({ homeDir })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA202' });
  });
});
