import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
  type ProjectRelativePath,
} from '../index.js';
import {
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
} from '../database/access/asset-relationships/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { stageTrashFiles } from '../trash/trash-file-staging.js';

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
      'shotlist/sequences/01-logistics/scenes/01-foundry/narration.wav';
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

  it('discards one asset relationship while keeping other active owners', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/plate.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'plate bytes');

    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Shared plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const now = new Date().toISOString();
      insertAssetRelationshipRecord(session, { kind: 'project' }, {
        relationshipId: 'project_asset_shared_plate',
        assetId: registered.assetId,
        localeId: null,
        role: 'reference',
        sortOrder: nextAssetRelationshipSortOrder(session, {
          target: { kind: 'project' },
          role: 'reference',
          localeId: null,
        }),
        now,
      });
    } finally {
      session.close();
    }

    const discarded = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });

    expect(discarded.recovery.trashItemIds).toHaveLength(1);
    const sharedPreview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });
    expect(sharedPreview.files).toHaveLength(0);
    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
      })
    ).resolves.toEqual([]);
    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'project' },
      })
    ).resolves.toEqual([
      expect.objectContaining({
        assetId: registered.assetId,
        files: [expect.objectContaining({ projectRelativePath: assetPath })],
      }),
    ]);

    await projectData.restoreAsset({
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
    ).resolves.toEqual([
      expect.objectContaining({
        assetId: registered.assetId,
      }),
    ]);
  });

  it('blocks garbage collection when a discarded asset gains an active owner', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/blocked.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'blocked bytes');
    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Blocked plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const now = new Date().toISOString();
      insertAssetRelationshipRecord(session, { kind: 'project' }, {
        relationshipId: 'project_asset_blocked_plate',
        assetId: registered.assetId,
        localeId: null,
        role: 'reference',
        sortOrder: nextAssetRelationshipSortOrder(session, {
          target: { kind: 'project' },
          role: 'reference',
          localeId: null,
        }),
        now,
      });
    } finally {
      session.close();
    }

    await expect(
      projectData.previewGarbageCollection({
        projectName: 'constantinople',
        homeDir,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA280',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA280' })],
    });
  });


  it('blocks garbage collection when an active asset reuses a discarded file path', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/reused-path.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'first bytes');
    const discardedAsset = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Discarded plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: discardedAsset.assetId,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'replacement bytes');
    await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Replacement plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });

    await expect(
      projectData.previewGarbageCollection({
        projectName: 'constantinople',
        homeDir,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA280',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA280' })],
    });
    await expect(fs.readFile(path.join(created.projectPath, assetPath), 'utf8'))
      .resolves.toBe('replacement bytes');
  });

  it('keeps empty-trash dry runs from writing manifests or moving files', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/dry-run.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'dry run bytes');
    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Dry run plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });
    const preview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });

    const report = await projectData.emptyTrash({
      projectName: 'constantinople',
      homeDir,
      confirmationToken: preview.confirmationToken,
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    await expect(fs.access(path.join(created.projectPath, assetPath)))
      .resolves.toBeUndefined();
    await expect(
      fs.access(path.join(created.projectPath, report.manifestProjectRelativePath))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('writes an empty-trash manifest and stages discarded files together', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const assetPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/collectable.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'collectable bytes');
    const registered = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Collectable plate',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: registered.assetId,
    });
    const preview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });

    const report = await projectData.emptyTrash({
      projectName: 'constantinople',
      homeDir,
      confirmationToken: preview.confirmationToken,
    });

    expect(report.files).toEqual([
      expect.objectContaining({ originalProjectRelativePath: assetPath }),
    ]);
    await expect(fs.access(path.join(created.projectPath, assetPath)))
      .rejects.toMatchObject({ code: 'ENOENT' });
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(created.projectPath, report.manifestProjectRelativePath),
        'utf8'
      )
    ) as { operationId: string; files: Array<{ originalProjectRelativePath: string }> };
    expect(manifest).toMatchObject({
      operationId: report.operationId,
      files: [expect.objectContaining({ originalProjectRelativePath: assetPath })],
    });
  });

  it('reports missing trash files before moving any staged files', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const firstPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/keep-before-failure.png';
    const missingPath =
      'shotlist/sequences/01-logistics/scenes/01-foundry/missing-before-failure.png';
    for (const assetPath of [firstPath, missingPath]) {
      await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
        recursive: true,
      });
      await fs.writeFile(path.join(created.projectPath, assetPath), assetPath);
      const registered = await projectData.registerAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
        type: 'reference',
        mediaKind: 'image',
        title: assetPath,
        projectRelativePath: assetPath as ProjectRelativePath,
        fileRole: 'primary',
        role: 'reference',
      });
      await projectData.discardAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: 'scene_test0001' },
        assetId: registered.assetId,
      });
    }
    await fs.unlink(path.join(created.projectPath, missingPath));
    const preview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });

    await expect(
      projectData.emptyTrash({
        projectName: 'constantinople',
        homeDir,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA281',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA282' })],
    });
    await expect(fs.access(path.join(created.projectPath, firstPath)))
      .resolves.toBeUndefined();
  });

  it('reports path escape diagnostics before staging trash files', async () => {
    await expect(
      stageTrashFiles({
        projectFolder: homeDir,
        operationId: 'trash_operation_escape',
        dryRun: false,
        files: [
          {
            trashItemId: 'trash_item_escape',
            originalProjectRelativePath: '../escape.png',
            trashProjectRelativePath:
              '.renku/trash/emptied/trash_operation_escape/files/escape.png',
          },
        ],
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA281',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA260' })],
    });
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
