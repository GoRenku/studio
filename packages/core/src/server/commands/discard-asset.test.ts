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
    const assetFile = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      type: 'location_sheet',
      mediaKind: 'image',
      title: 'Location Sheet',
      projectRelativePath,
    });

    await expect(projectData.discardAssetFile({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      assetFileId: assetFile.id,
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_OWNER_MISMATCH',
    });

    const report = await projectData.discardAssetFile({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: 'location_test0001' },
      assetFileId: assetFile.id,
    });
    expect(report).toMatchObject({
      valid: true,
      project: { projectName: 'constantinople' },
      resourceKeys: ['surface:location:location_test0001'],
    });
  });

  it('rejects a mismatched expected type before moving the Asset to Trash', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const projectRelativePath = 'tmp/shot-plan.mp4' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, projectRelativePath), 'video');
    const assetFile = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'shot_plan_video',
      mediaKind: 'video',
      title: 'Shot Plan Video',
      projectRelativePath,
    });

    await expect(projectData.discardAssetFile({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      assetFileId: assetFile.id,
      expectedType: 'project_cover',
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_TYPE_MISMATCH',
    });

    await expect(projectData.listAssetFilePage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'shot_plan_video',
    })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: assetFile.id })],
    });
    await expect(projectData.listTrash({
      projectName: 'constantinople',
      homeDir,
    })).resolves.toMatchObject({ items: [] });
  });
});
