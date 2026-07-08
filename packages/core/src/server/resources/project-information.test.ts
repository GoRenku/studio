import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService, type ProjectRelativePath } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';

describe('project information resource', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-project-information-resource-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('updates project information without changing the immutable project name', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const resource = await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        summary: 'A revised project summary.',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: false,
            supportsAudio: true,
            supportsSubtitles: true,
          },
          {
            localeTag: 'tr-TR',
            displayName: 'Turkish',
            isBase: true,
            supportsAudio: false,
            supportsSubtitles: true,
          },
        ],
      },
    });

    expect(resource).toMatchObject({
      title: 'The Siege Machine',
      aspectRatio: '21:9',
      logline: 'A sharper premise.',
      summary: 'A revised project summary.',
    });
    expect(resource.languages).toEqual([
      expect.objectContaining({
        localeTag: 'en-US',
        isBase: false,
        supportsAudio: true,
        supportsSubtitles: true,
      }),
      expect.objectContaining({
        localeTag: 'tr-TR',
        isBase: true,
        supportsAudio: false,
        supportsSubtitles: true,
      }),
    ]);
  });

  it('persists cleared project information text fields', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        summary: 'A revised project summary.',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
      },
    });

    const resource = await projectData.updateProjectInformation({
      projectName: 'constantinople',
      homeDir,
      information: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: '',
        summary: '   ',
        languages: [
          {
            localeTag: 'en-US',
            displayName: 'English',
            isBase: true,
            supportsAudio: true,
            supportsSubtitles: true,
          },
        ],
      },
    });

    expect(resource.logline).toBeUndefined();
    expect(resource.summary).toBeUndefined();
    await expect(
      projectData.readProject({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      identity: {
        logline: undefined,
        summary: undefined,
      },
    });
  });

  it('clears the SQLite-backed project summary through a patch', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { summary: null },
    });

    await expect(
      projectData.readProject({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      identity: { summary: undefined },
    });
  });

  it('rejects removing a locale that still has asset relationships', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const assetPath = 'screenplay/project-reference.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');
    await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      locale: { localeId: 'locale_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Project reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.updateProjectInformation({
        projectName: 'constantinople',
        homeDir,
        information: {
          title: 'Preparation of the Siege',
          aspectRatio: '16:9',
          logline: 'A documentary about preparation before 1453.',
          summary: 'A documentary project summary stored in SQLite.',
          languages: [
            {
              localeTag: 'tr-TR',
              displayName: 'Turkish',
              isBase: true,
              supportsAudio: true,
              supportsSubtitles: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA058',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA057',
          message: expect.stringContaining('project_asset'),
        }),
      ]),
    });
  });

  it('collects project information validation errors', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await expect(
      projectData.updateProjectInformation({
        projectName: 'constantinople',
        homeDir,
        information: {
          title: '',
          aspectRatio: '2:1',
          languages: [
            {
              localeTag: 'en-US',
              displayName: 'English',
              isBase: false,
              supportsAudio: true,
              supportsSubtitles: true,
            },
            {
              localeTag: 'en-US',
              displayName: 'English',
              isBase: false,
              supportsAudio: true,
              supportsSubtitles: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA056',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA050' }),
        expect.objectContaining({ code: 'PROJECT_DATA051' }),
        expect.objectContaining({ code: 'PROJECT_DATA054' }),
        expect.objectContaining({ code: 'PROJECT_DATA055' }),
      ]),
    });
  });
});
