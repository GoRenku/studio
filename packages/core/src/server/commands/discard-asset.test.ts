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

describe('discard Asset', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-discard-asset-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('returns the owner surface and no invented generic Asset key', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const projectRelativePath = 'tmp/sheet.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'image');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'location', locationId: 'location_test0001' },
      type: 'location-sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
      fileRole: 'primary',
      role: 'location-sheet',
    });

    const report = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'location', locationId: 'location_test0001' },
      assetId: asset.assetId,
    });
    expect(report).toMatchObject({
      valid: true,
      project: { name: 'constantinople' },
      resourceKeys: ['surface:location:location_test0001'],
    });
  });
});
