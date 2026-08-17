import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
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
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
      fileRole: 'primary',
    });

    await expect(projectData.updateAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: asset.id,
      title: 'Changed title',
      localeId: 'locale_missing',
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_LOCALE_INVALID',
    });

    await expect(projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
    })).resolves.toEqual([
      expect.objectContaining({
        id: asset.id,
        title: 'Location Sheet',
        localeId: null,
      }),
    ]);
  });

  it('normalizes complete tag lists once and preserves omission, replacement, and clearing', async () => {
    const { projectData, asset } = await createLocationAsset();

    const updated = await projectData.updateAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: asset.id,
      oneLineSummary: '  Storyboard rendering  ',
      referenceName: '  siege-storyboard  ',
      tags: [' storyboard ', 'previs', 'storyboard', 'Storyboard'],
    });
    expect(updated.asset).toMatchObject({
      oneLineSummary: 'Storyboard rendering',
      referenceName: 'siege-storyboard',
      tags: ['storyboard', 'previs', 'Storyboard'],
    });

    await expect(projectData.updateAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: asset.id,
      title: 'Renamed Location Sheet',
    })).resolves.toMatchObject({
      asset: { tags: ['storyboard', 'previs', 'Storyboard'] },
    });
    await expect(projectData.updateAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: asset.id,
      oneLineSummary: '   ',
      referenceName: null,
      tags: [],
    })).resolves.toMatchObject({
      asset: { oneLineSummary: null, referenceName: null, tags: [] },
    });
  });

  it('rejects empty and non-string tags before changing the Asset', async () => {
    const { projectData, asset } = await createLocationAsset();

    for (const tags of [['valid', '  '], ['valid', 42]]) {
      await expect(projectData.updateAsset({
        projectName: 'constantinople',
        homeDir,
        assetId: asset.id,
        tags: tags as string[],
      })).rejects.toMatchObject({
        code: 'CORE_ASSET_TAGS_INVALID',
        issues: [expect.objectContaining({ code: 'CORE_ASSET_TAGS_INVALID' })],
      });
    }
    await expect(projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
    })).resolves.toEqual([
      expect.objectContaining({ id: asset.id, tags: [] }),
    ]);
  });

  async function createLocationAsset() {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected sample Project creation.');
    }
    const projectRelativePath = 'tmp/reference.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'image');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
      fileRole: 'primary',
    });
    return { projectData, asset };
  }
});
