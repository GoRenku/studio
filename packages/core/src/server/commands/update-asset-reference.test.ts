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

describe('update Asset reference', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-asset-update-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('returns project identity and Core-owned owner surface keys', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const projectRelativePath = 'tmp/profile.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'image');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      type: 'profile',
      mediaKind: 'image',
      title: 'Profile',
      projectRelativePath,
      fileRole: 'primary',
      role: 'profile',
    });

    const report = await projectData.updateAssetReference({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      assetId: asset.assetId,
      referenceName: 'urban-profile',
    });

    expect(report).toMatchObject({
      valid: true,
      warnings: [],
      project: {
        id: expect.any(String),
        name: 'constantinople',
        projectFolder: created.projectPath,
      },
      asset: { assetId: asset.assetId, referenceName: 'urban-profile' },
      resourceKeys: ['surface:castMember:cast_test0001'],
    });
  });
});
