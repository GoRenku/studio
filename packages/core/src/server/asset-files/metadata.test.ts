import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFileFixture } from '../testing/asset-fixture-helpers.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Asset metadata', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-asset-metadata-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('rejects an unknown locale with a structured Core error before writing', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const projectRelativePath = 'tmp/reference.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'image');
    const assetFile = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
    });

    await expect(projectData.updateAssetFile({
      projectName: 'constantinople',
      homeDir,
      assetFileId: assetFile.id,
      title: 'Changed title',
      localeId: 'locale_missing',
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_LOCALE_INVALID',
    });

    await expect(projectData.listAssetFiles({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
    })).resolves.toEqual([
      expect.objectContaining({
        id: assetFile.id,
        title: 'Location Sheet',
        localeId: null,
      }),
    ]);
  });

  it('normalizes complete tag lists once and preserves omission, replacement, and clearing', async () => {
    const { projectData, assetFile } = await createLocationAssetFile();

    const updated = await projectData.updateAssetFile({
      projectName: 'constantinople',
      homeDir,
      assetFileId: assetFile.id,
      oneLineSummary: '  Storyboard rendering  ',
      referenceName: '  siege-storyboard  ',
      tags: [' storyboard ', 'previs', 'storyboard', 'Storyboard'],
    });
    expect(updated.assetFile).toMatchObject({
      oneLineSummary: 'Storyboard rendering',
      referenceName: 'siege-storyboard',
      tags: ['storyboard', 'previs', 'Storyboard'],
    });

    await expect(projectData.updateAssetFile({
      projectName: 'constantinople',
      homeDir,
      assetFileId: assetFile.id,
      title: 'Renamed Location Sheet',
    })).resolves.toMatchObject({
      assetFile: { tags: ['storyboard', 'previs', 'Storyboard'] },
    });
    await expect(projectData.updateAssetFile({
      projectName: 'constantinople',
      homeDir,
      assetFileId: assetFile.id,
      oneLineSummary: '   ',
      referenceName: null,
      tags: [],
    })).resolves.toMatchObject({
      assetFile: { oneLineSummary: null, referenceName: null, tags: [] },
    });
  });

  it('rejects empty and non-string tags before changing the Asset', async () => {
    const { projectData, assetFile } = await createLocationAssetFile();

    for (const tags of [['valid', '  '], ['valid', 42]]) {
      await expect(projectData.updateAssetFile({
        projectName: 'constantinople',
        homeDir,
        assetFileId: assetFile.id,
        tags: tags as string[],
      })).rejects.toMatchObject({
        code: 'CORE_ASSET_TAGS_INVALID',
        issues: [expect.objectContaining({ code: 'CORE_ASSET_TAGS_INVALID' })],
      });
    }
    await expect(projectData.listAssetFiles({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
    })).resolves.toEqual([
      expect.objectContaining({ id: assetFile.id, tags: [] }),
    ]);
  });

  async function createLocationAssetFile() {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected sample Project creation.');
    }
    const projectRelativePath = 'tmp/reference.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'image');
    const assetFile = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
    });
    return { projectData, assetFile };
  }
});
