import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
    const project = await projectData.readProject({
      homeDir,
      projectName: 'constantinople',
    });

    expect(created.created.languages).toBe(1);
    expect(project.languages).toEqual([
      {
        id: 'locale_test0001',
        localeTag: 'en-US',
        displayName: 'English',
        isBase: true,
        supportsAudio: true,
        supportsSubtitles: true,
      },
    ]);
    expect(project.counts.languages).toBe(1);
  });
});
