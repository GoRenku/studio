import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
} from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('project library resource', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-project-library-resource-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('lists only SQLite-backed projects from storageRoot', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(storageRoot, 'notes-only'), { recursive: true });

    const library = await projectData.listLibrary({ homeDir });

    expect(library.storageRoot).toBe(storageRoot);
    expect(library.projects).toHaveLength(1);
    expect(library.projects[0]).toMatchObject({
      name: 'constantinople',
      title: 'Preparation of the Siege',
    });
  });

  it('keeps listing the project library when one project database cannot be opened', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const brokenProjectFolder = path.join(storageRoot, 'broken-project');
    await fs.mkdir(path.join(brokenProjectFolder, '.renku'), { recursive: true });
    await fs.writeFile(
      path.join(brokenProjectFolder, '.renku', 'project.sqlite'),
      'not a sqlite database',
      'utf8'
    );

    const library = await projectData.listLibrary({ homeDir });

    expect(library.projects).toHaveLength(2);
    expect(library.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'constantinople',
          validationError: null,
        }),
        expect.objectContaining({
          name: 'broken-project',
          title: 'broken-project',
          counts: null,
          validationError: expect.objectContaining({
            code: 'PROJECT_DATA044',
          }),
        }),
      ])
    );
  });
});
