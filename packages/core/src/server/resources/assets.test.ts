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
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { insertAssetMembershipRecord } from '../database/access/asset-memberships.js';

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

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'audio bytes');

    const registered = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'scene', id: 'scene_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
    });

    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        owner: { kind: 'scene', id: 'scene_test0001' },
      })
    ).resolves.toEqual([
        expect.objectContaining({
          id: registered.id,
          files: [expect.objectContaining({ projectRelativePath: assetPath })],
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
          const assetId = `asset_page_${String(index).padStart(3, '0')}`;
          insertAssetRecord(transactionSession, {
            id: assetId,
            type: 'narration',
            mediaKind: 'audio',
            title: `Narration ${index}`,
            origin: 'external',
            availability: 'ready',
            createdAt: now,
            updatedAt: now,
          });
          insertAssetMembershipRecord(transactionSession, {
            assetId,
            ownerKey: 'scene:scene_test0001',
            now,
          });
        }
      });
    } finally {
      session.close();
    }

    const assets = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'scene', id: 'scene_test0001' },
    });

    expect(assets).toHaveLength(205);
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(205);
  });
});
