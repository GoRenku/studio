import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectRelativePath,
} from '../index.js';
import {
  runCreateOrSkip,
  writeConfig,
  writeProjectSetup,
} from '../testing/project-data-fixtures.js';

describe('change asset selection command', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-change-asset-selection-command-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('selects an attached asset', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
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
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });

    await expect(
      projectData.createAssetSelect({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
        assetId: registered.assetId,
      })
    ).resolves.toMatchObject({
      assetId: registered.assetId,
      selection: { kind: 'select', order: 1 },
    });
  });

  it('rejects selecting an asset attached to another target', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const assetPath = 'working-assets/base/screenplay/reference.txt';
    await fs.writeFile(path.join(created.projectPath, assetPath), 'reference');
    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      type: 'reference',
      mediaKind: 'text',
      title: 'Project reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.createAssetSelect({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0001' },
        assetId: registered.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA078' });
  });

  it('rejects selecting an asset attached to another clip', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
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
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });

    await expect(
      projectData.createAssetSelect({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'clip', clipId: 'clip_test0002' },
        assetId: registered.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA078' });
  });
});
