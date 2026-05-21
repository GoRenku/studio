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

describe('register asset command', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-register-asset-command-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('registers, lists, selects, and reopens an attached asset', async () => {
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

    expect(registered).toMatchObject({
      type: 'narration',
      availability: 'ready',
      role: 'narration',
      selection: { kind: 'take' },
      files: [expect.objectContaining({ projectRelativePath: assetPath })],
    });

    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
      })
    ).resolves.toHaveLength(1);

    const selected = await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });
    expect(selected.selection).toEqual({ kind: 'select', order: 1 });

    await expect(
      projectData.listAssetSelects({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
      })
    ).resolves.toEqual([expect.objectContaining({ assetId: registered.assetId })]);

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

  it('reads project fields when visual language has image reference assets', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/visual-language/lighting/01-practical-source-low-key-interiors/reference.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');

    await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'visualLanguage', visualLanguageId: 'visual_language_test0001' },
      type: 'image',
      mediaKind: 'image',
      title: 'Lighting reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.readProject({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      visualLanguage: [
        expect.objectContaining({
          id: 'visual_language_test0001',
          summary: 'Warm practical interiors.',
        }),
      ],
    });
  });

  it('keeps visual language prompt images as assets instead of rich-text data', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'working-assets/base/visual-language/lighting/01-practical-source-low-key-interiors/prompt.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');

    const asset = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'visualLanguage', visualLanguageId: 'visual_language_test0001' },
      type: 'image',
      mediaKind: 'image',
      title: 'Invalid prompt image',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'prompt',
    });

    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: {
          kind: 'visualLanguage',
          visualLanguageId: 'visual_language_test0001',
        },
      })
    ).resolves.toEqual([expect.objectContaining({ assetId: asset.assetId })]);
  });

  it('rejects registering a file outside the project', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await expect(
      projectData.registerAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
        type: 'narration',
        mediaKind: 'audio',
        title: 'Outside narration',
        projectRelativePath: '../outside.wav' as ProjectRelativePath,
        fileRole: 'primary',
        role: 'narration',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA060' });
  });
});
