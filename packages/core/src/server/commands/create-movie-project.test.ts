import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_SETTINGS,
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import { writeConfig } from '../testing/project-data-fixtures.js';

describe('createMovieProject', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-create-movie-project-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('creates en-US as the base language when none is explicitly provided', async () => {
    const projectData = createProjectDataService();

    const created = await projectData.createMovieProject({
      homeDir,
      projectName: 'constantinople',
      title: 'Preparation of the Siege',
      idGenerator: createDeterministicIdGenerator(),
    });
    const shell = await projectData.readProjectShell({
      homeDir,
      projectName: 'constantinople',
    });
    const settings = await projectData.readProjectSettings({
      homeDir,
      projectName: 'constantinople',
    });
    const screenplay = await projectData.readScreenplayStructure({
      homeDir,
      projectName: 'constantinople',
    });

    expect(created.created.languages).toBe(1);
    expect(created).toMatchObject({
      projectName: 'constantinople',
      projectPath: path.join(homeDir, 'projects', 'constantinople'),
      databasePath: path.join(
        homeDir,
        'projects',
        'constantinople',
        '.renku',
        'project.sqlite'
      ),
      created: {
        languages: 1,
        castMembers: 0,
        locations: 0,
        props: 0,
        acts: 0,
        sequences: 0,
        scenes: 0,
      },
      warnings: [],
    });
    expect(shell.languages).toEqual([
      {
        id: 'locale_test0001',
        localeTag: 'en-US',
        displayName: 'English',
        isBase: true,
        supportsAudio: true,
        supportsSubtitles: true,
      },
    ]);
    expect(shell.project.counts.languages).toBe(1);
    expect(settings.settings).toEqual(DEFAULT_PROJECT_SETTINGS);
    expect(screenplay.screenplay.scenes).toEqual([]);
    expect((await fs.stat(created.databasePath)).isFile()).toBe(true);
  });

  it('rejects a blank title before creating the Project folder', async () => {
    const projectData = createProjectDataService();
    const projectFolder = path.join(homeDir, 'projects', 'blank-title');

    await expect(
      projectData.createMovieProject({
        homeDir,
        projectName: 'blank-title',
        title: '   ',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA050',
      issues: [
        {
          location: { path: ['title'] },
        },
      ],
    });
    await expect(fs.stat(projectFolder)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an invalid Project name before creating the Project folder', async () => {
    const projectData = createProjectDataService();

    await expect(
      projectData.createMovieProject({
        homeDir,
        projectName: 'Invalid Project',
        title: 'The Glass Harbor',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA025',
      issues: [
        {
          location: { path: ['projectName'] },
        },
      ],
    });
    await expect(
      fs.stat(path.join(homeDir, 'projects', 'Invalid Project'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an existing Project folder without changing its contents', async () => {
    const projectData = createProjectDataService();
    const projectFolder = path.join(homeDir, 'projects', 'the-glass-harbor');
    const markerPath = path.join(projectFolder, 'keep.txt');
    await fs.mkdir(projectFolder, { recursive: true });
    await fs.writeFile(markerPath, 'keep me');

    await expect(
      projectData.createMovieProject({
        homeDir,
        projectName: 'the-glass-harbor',
        title: 'The Glass Harbor',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA024',
      issues: [
        {
          location: { path: ['projectName'] },
        },
      ],
      suggestion: 'Choose another Folder name.',
    });
    await expect(fs.readFile(markerPath, 'utf8')).resolves.toBe('keep me');
  });
});
