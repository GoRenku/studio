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

describe('asset resources', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-asset-resources-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('lists registered assets, selected assets, and persisted selections', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'audio bytes');

    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });

    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });

    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: registered.assetId,
          files: [expect.objectContaining({ projectRelativePath: assetPath })],
        }),
      ])
    );

    await expect(
      createProjectDataService().listAssetSelects({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
      })
    ).resolves.toEqual([
      expect.objectContaining({
        assetId: registered.assetId,
        selection: { kind: 'select', order: 1 },
      }),
    ]);
  });
});
