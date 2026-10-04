import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
  type ProjectRelativePath,
} from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { createTestAssetFileFixture } from '../testing/asset-fixture-helpers.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';

describe('asset resources', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-asset-resources-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('lists registered assets without generic selection state', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetFilePath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetFilePath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetFilePath), 'audio bytes');

    const registered = await createTestAssetFileFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'scene', id: 'scene_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetFilePath as ProjectRelativePath,
    });

    await expect(
      projectData.listAssetFiles({
        projectName: 'constantinople',
        homeDir,
        owner: { kind: 'scene', id: 'scene_test0001' },
      })
    ).resolves.toEqual([
        expect.objectContaining({
          id: registered.id,
          projectRelativePath: assetFilePath,
        }),
    ]);
  });

  it('collects every owner page when more than 200 Assets exist', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const session = openProjectStore({
      projectFolder: created.projectPath,
      create: false,
      lifetime: 'project',
    });
    try {
      const now = '2026-07-26T20:00:00.000Z';
      session.db.transaction((tx) => {
        const transactionSession = { ...session, db: tx };
        for (let index = 0; index < 205; index += 1) {
          const assetFileId = `asset_page_${String(index).padStart(3, '0')}`;
          insertAssetFileRecord(transactionSession, {
            id: assetFileId,
            ownerKey: 'scene:scene_test0001',
            projectRelativePath: `media/page-${index}.wav`,
            type: 'narration',
            mediaKind: 'audio',
            title: `Narration ${index}`,
            origin: 'external',
            availability: 'ready',
            createdAt: now,
            updatedAt: now,
          });

        }
      });
    } finally {
      session.close();
    }

    const assetFiles = await projectData.listAssetFiles({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'scene', id: 'scene_test0001' },
    });

    expect(assetFiles).toHaveLength(205);
    expect(new Set(assetFiles.map((assetFile) => assetFile.id)).size).toBe(205);
  });
});
