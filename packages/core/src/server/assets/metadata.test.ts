import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/project.js';
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
});
