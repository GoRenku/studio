import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('scene shot list commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-shot-list-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('returns scene-specific shot-list context', async () => {
    const ids = await sampleIds();
    const context = await projectData.readSceneShotListContext({
      homeDir,
      sceneId: ids.sceneId,
    });

    expect(context.valid).toBe(true);
    expect(context.project.aspectRatio).toBe('16:9');
    expect(context.scene.title).toBe('A Throne Facing an Ancient City');
    expect(context.cast).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.castMemberId })])
    );
    expect(context.locations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.locationId })])
    );
    expect(context.activeShotList).toBeNull();
  });

  it('validates shot lists and reports structured reference failures', async () => {
    const ids = await sampleIds();
    const valid = sampleShotList(ids);

    await expect(
      projectData.validateSceneShotList({ homeDir, document: valid })
    ).resolves.toMatchObject({ valid: true });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [
            {
              ...valid.shots[0]!,
              shotId: 'shot_001_duplicate',
              coveredBlockIndexes: [99],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA320',
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('outside the scene'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [{ ...valid.shots[0]!, castMemberIds: ['cast_missing'] }],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('unknown cast member'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [
            valid.shots[0]!,
            {
              ...valid.shots[0]!,
              title: 'Duplicate identifier',
              locationIds: ['location_missing'],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Duplicate shotId'),
        }),
        expect.objectContaining({
          message: expect.stringContaining('unknown location'),
        }),
      ]),
    });
  });

  it('writes shot-list history, sets active, and preserves older rows', async () => {
    const ids = await sampleIds();
    const idGenerator = createDeterministicIdGenerator();
    const first = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'First pass'),
      idGenerator,
    });
    const second = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'Second pass'),
      idGenerator,
    });

    expect(first.shotList.id).not.toEqual(second.shotList.id);
    expect(second.activeShotListId).toBe(second.shotList.id);

    const list = await projectData.listSceneShotLists({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(list.shotLists.map((shotList) => shotList.id)).toEqual(
      expect.arrayContaining([first.shotList.id, second.shotList.id])
    );

    await projectData.setActiveSceneShotList({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: first.shotList.id,
    });

    await expect(
      projectData.readSceneShotList({
        homeDir,
        active: true,
        sceneId: ids.sceneId,
      })
    ).resolves.toMatchObject({
      summary: { id: first.shotList.id },
      shotList: { title: 'First pass' },
    });
  });

  it('applies operations against an explicit base and carries forward unchanged images', async () => {
    const ids = await sampleIds();
    const baseDocument = sampleShotList(ids, 'Base coverage', 3);
    const base = await projectData.writeSceneShotList({
      homeDir,
      document: baseDocument,
      idGenerator: createDeterministicIdGenerator(),
    });
    await importStoryboardImages(ids.sceneId, base.shotList.id, [
      'shot_002',
      'shot_003',
    ]);
    const active = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'Current active coverage', 1),
    });

    const operationShot = {
      ...baseDocument.shots[0]!,
      shotId: 'shot_inserted',
      title: 'Inserted map detail',
      description: 'A new insert shot of the map edge.',
    };
    const document = {
      kind: 'sceneShotListOperations' as const,
      sceneId: ids.sceneId,
      baseShotListId: base.shotList.id,
      activate: false,
      title: 'Base coverage with insert',
      operations: [
        {
          operation: 'shots.insert' as const,
          placement: { position: 'before' as const, shotId: 'shot_002' },
          shots: [operationShot],
        },
      ],
    };

    await expect(
      projectData.validateSceneShotListOperations({ homeDir, document })
    ).resolves.toMatchObject({ valid: true });

    const dryRun = await projectData.applySceneShotListOperations({
      homeDir,
      document,
      dryRun: true,
    });
    expect(dryRun.createdShotListId).toBe(`${base.shotList.id}_dry_run`);
    expect(dryRun.storyboard.readyShotIds.sort()).toEqual([
      'shot_002',
      'shot_003',
    ]);
    expect(dryRun.storyboard.missingShotIds.sort()).toEqual([
      'shot_001',
      'shot_inserted',
    ]);
    expect(
      dryRun.storyboard.shots.find((shot) => shot.shotId === 'shot_002')?.image
    ).toMatchObject({ simulated: true });

    const applied = await projectData.applySceneShotListOperations({
      homeDir,
      document,
    });
    expect(applied.baseShotListId).toBe(base.shotList.id);
    expect(applied.createdShotListId).not.toBe(base.shotList.id);
    expect(applied.changes).toEqual(
      expect.arrayContaining([
        { type: 'inserted', shotIds: ['shot_inserted'] },
        { type: 'preserved', shotIds: ['shot_001', 'shot_002', 'shot_003'] },
      ])
    );

    await expect(
      projectData.readSceneShotList({
        homeDir,
        active: true,
        sceneId: ids.sceneId,
      })
    ).resolves.toMatchObject({
      summary: { id: active.shotList.id },
      shotList: { title: 'Current active coverage' },
    });

    const created = await projectData.readSceneShotList({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: applied.createdShotListId,
    });
    expect(created.shotList?.baseShotListId).toBe(base.shotList.id);
    expect(created.shotList?.shots.map((shot) => shot.shotId)).toEqual([
      'shot_001',
      'shot_inserted',
      'shot_002',
      'shot_003',
    ]);

    const status = await projectData.readSceneShotListStoryboardStatus({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: applied.createdShotListId,
    });
    expect(status.readyShotIds.sort()).toEqual(['shot_002', 'shot_003']);
    expect(status.missingShotIds.sort()).toEqual([
      'shot_001',
      'shot_inserted',
    ]);
  });

  it('carries forward unchanged storyboard images for full replacements with an explicit base', async () => {
    const ids = await sampleIds();
    const baseDocument = sampleShotList(ids, 'Base coverage', 3);
    const idGenerator = createDeterministicIdGenerator();
    const base = await projectData.writeSceneShotList({
      homeDir,
      document: baseDocument,
      idGenerator,
    });
    await importStoryboardImages(ids.sceneId, base.shotList.id, [
      'shot_001',
      'shot_002',
      'shot_003',
    ]);

    const written = await projectData.writeSceneShotList({
      homeDir,
      document: {
        ...baseDocument,
        baseShotListId: base.shotList.id,
        title: 'Replacement coverage with an insert',
        shots: [
          baseDocument.shots[0]!,
          {
            ...baseDocument.shots[0]!,
            shotId: 'shot_inserted',
            title: 'Inserted strategic detail',
            description: 'A new insert shot that needs new storyboard art.',
          },
          {
            ...baseDocument.shots[1]!,
            title: 'Changed map study alternate',
          },
          baseDocument.shots[2]!,
        ],
      },
    });

    const status = await projectData.readSceneShotListStoryboardStatus({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
    });

    expect(status.readyShotIds.sort()).toEqual(['shot_001', 'shot_003']);
    expect(status.missingShotIds.sort()).toEqual([
      'shot_002',
      'shot_inserted',
    ]);
  });

  it('imports per-shot storyboard image assets', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    const project = await projectData.readCurrentProject({ homeDir });
    expect(project).not.toBeNull();
    const shotPath = path.join(
      project!.projectFolder,
      'generated',
      'media',
      'shot.png'
    );
    await fs.mkdir(path.dirname(shotPath), { recursive: true });
    await fs.writeFile(shotPath, 'shot');

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [
            {
              shotId: 'shot_001',
              source: 'generated/media/missing-shot.png',
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA342',
    });

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [{ shotId: 'shot_missing', source: 'generated/media/shot.png' }],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA325',
    });

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA337',
    });

    const report = await projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId: written.shotList.id,
        shots: [{ shotId: 'shot_001', source: 'generated/media/shot.png' }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.imported.map((asset) => asset.type)).toEqual([
      'scene_storyboard_image',
    ]);
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_001' }),
      ])
    );
    expect(report.files).toHaveLength(1);
    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_001`,
      ])
    );
  });

  it('imports partial storyboard images for a longer shot list', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'Longer coverage', 5),
      idGenerator: createDeterministicIdGenerator(),
    });
    const project = await projectData.readCurrentProject({ homeDir });
    expect(project).not.toBeNull();
    const mediaFolder = path.join(project!.projectFolder, 'generated', 'media');
    await fs.mkdir(mediaFolder, { recursive: true });
    await fs.writeFile(path.join(mediaFolder, 'shot-001.png'), 'shot 1');
    await fs.writeFile(path.join(mediaFolder, 'shot-002.png'), 'shot 2');

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [
            { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
            { shotId: 'shot_001', source: 'generated/media/shot-002.png' },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA336',
    });

    const report = await projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId: written.shotList.id,
        shots: [
          { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
          { shotId: 'shot_002', source: 'generated/media/shot-002.png' },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_001' }),
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_002' }),
      ])
    );
    expect(report.files).toHaveLength(2);
    expect(report.resourceKeys).toEqual(
      expect.not.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_005`,
      ])
    );
  });

  it('stores imported storyboard images directly by shot list and shot id', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'Longer coverage', 5),
      idGenerator: createDeterministicIdGenerator(),
    });
    const project = await projectData.readCurrentProject({ homeDir });
    expect(project).not.toBeNull();
    const mediaFolder = path.join(project!.projectFolder, 'generated', 'media');
    await fs.mkdir(mediaFolder, { recursive: true });
    for (const filename of [
      'shot-001.png',
      'shot-002.png',
      'shot-005.png',
    ]) {
      await fs.writeFile(path.join(mediaFolder, filename), filename);
    }

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          title: 'Grouped storyboard package',
          shots: [],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA337' });

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [
            { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
            { shotId: 'shot_001', source: 'generated/media/shot-002.png' },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA336' });

    await expect(
      projectData.importSceneStoryboardImagesMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardImagesImport',
          shotListId: written.shotList.id,
          shots: [
            { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
            { shotId: 'shot_002', source: 'generated/media/shot-001.png' },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA338' });

    const report = await projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId: written.shotList.id,
        title: 'Grouped storyboard package',
        shots: [
          { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
          { shotId: 'shot_002', source: 'generated/media/shot-002.png' },
          { shotId: 'shot_005', source: 'generated/media/shot-005.png' },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.imported.map((asset) => asset.type)).toEqual([
      'scene_storyboard_image',
      'scene_storyboard_image',
      'scene_storyboard_image',
    ]);
    expect(report.storyboardImageIds).toHaveLength(3);
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_001' }),
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_002' }),
        expect.objectContaining({ role: 'storyboard_image', shotId: 'shot_005' }),
      ])
    );
    expect(report.files).toHaveLength(3);
    expect(
      new Set(report.files.map((file) => path.dirname(file.projectRelativePath))).size
    ).toBe(1);
    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_005`,
      ])
    );

    const sqlite = new Database(
      path.join(project!.projectFolder, '.renku', 'project.sqlite')
    );
    try {
      const rows = sqlite
        .prepare(
          'select shot_id, asset_id from scene_shot_storyboard_image where shot_list_id = ? order by shot_id'
        )
        .all(written.shotList.id) as Array<{ shot_id: string; asset_id: string }>;
      expect(rows.map((row) => row.shot_id)).toEqual([
        'shot_001',
        'shot_002',
        'shot_005',
      ]);
      expect(rows.map((row) => row.asset_id)).toEqual(
        report.imported.map((asset) => asset.assetId)
      );
    } finally {
      sqlite.close();
    }
  });

  it('validates scene storyboard sheet specs and preserves binding options', async () => {
    const ids = await sampleIds();
    const overrideLocationId = await addFlashbackLocation();
    const shotList = sampleShotList(
      ids,
      'Longer coverage',
      5
    );
    shotList.shots[0] = {
      ...shotList.shots[0]!,
      locationIds: [overrideLocationId],
    };
    shotList.shots[1] = {
      ...shotList.shots[1]!,
      locationIds: [ids.locationId],
    };
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: shotList,
      idGenerator: createDeterministicIdGenerator(),
    });
    await createSelectedStoryboardLookbook();

    const context = await projectData.buildSceneStoryboardSheetContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
    });
    expect(context.defaults).toMatchObject({
      sheetFrame: '4:3',
      shotFrame: 'project',
      resolvedShotFrame: '16:9',
      maxShotsPerSheet: 4,
    });

    await expect(
      projectData.validateSceneStoryboardSheetSpec({
        homeDir,
        spec: {
          purpose: 'scene.storyboard-sheet',
          target: { kind: 'scene', id: ids.sceneId },
          shotListId: written.shotList.id,
          shotIds: ['shot_001', 'shot_002'],
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A clean storyboard sheet for selected shots.',
          takeCount: 1,
          sheetFrame: '4:3',
          shotFrame: 'project',
          detail: 'standard',
          outputFormat: 'png',
        },
      })
    ).resolves.toMatchObject({
      valid: true,
      spec: {
        sheetFrame: '4:3',
        shotFrame: 'project',
        shotIds: ['shot_001', 'shot_002'],
        takeCount: 1,
      },
      providerPayload: {
        aspect_ratio: '4:3',
      },
    });

    const validation = await projectData.validateSceneStoryboardSheetSpec({
      homeDir,
      spec: {
        purpose: 'scene.storyboard-sheet',
        target: { kind: 'scene', id: ids.sceneId },
        shotListId: written.shotList.id,
        shotIds: ['shot_001', 'shot_002'],
        modelChoice: 'fal-ai/nano-banana-2',
        prompt: 'A clean storyboard sheet for selected shots.',
        takeCount: 1,
        sheetFrame: '4:3',
        shotFrame: 'project',
        detail: 'standard',
        outputFormat: 'png',
      },
    });
    expect(validation.providerPayload.prompt).toContain(
      'Each panel is a clean 16:9 landscape storyboard frame.'
    );
    expect(validation.providerPayload.prompt).toContain('shot_001');
    expect(validation.providerPayload.prompt).toContain('shot_002');
    expect(validation.providerPayload.prompt).toContain(
      'lens intent: moderate wide lens feel'
    );
    expect(validation.providerPayload.prompt).toContain(
      `location: Golden Horn overlook (${overrideLocationId})`
    );
    expect(validation.providerPayload.prompt).toContain(
      `location: Mehmed's council chamber (${ids.locationId})`
    );
    expect(validation.providerPayload.prompt).toContain(
      `Golden Horn overlook (${overrideLocationId})`
    );
    expect(validation.providerPayload.prompt).not.toContain('shot_005');

    await expect(
      projectData.validateSceneStoryboardSheetSpec({
        homeDir,
        spec: {
          purpose: 'scene.storyboard-sheet',
          target: { kind: 'scene', id: ids.sceneId },
          shotListId: written.shotList.id,
          shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'Too many shots for one storyboard sheet.',
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA345' });

    await expect(
      projectData.validateSceneStoryboardSheetSpec({
        homeDir,
        spec: {
          purpose: 'scene.storyboard-sheet',
          target: { kind: 'scene', id: ids.sceneId },
          shotListId: written.shotList.id,
          shotIds: ['shot_missing'],
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A storyboard sheet with a missing shot.',
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA325' });
  });

  async function sampleIds() {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    return {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
    };
  }

  async function addFlashbackLocation() {
    await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'golden-horn-overlook',
              handle: 'golden-horn-overlook',
              name: 'Golden Horn overlook',
              description: 'A wind-exposed overlook above the harbor.',
            },
          },
        ],
      },
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const location = screenplay.screenplay!.locations.find(
      (entry) => entry.handle === 'golden-horn-overlook'
    );
    if (!location?.id) {
      throw new Error('Expected test location to be created.');
    }
    return location.id as string;
  }

  async function importStoryboardImages(
    sceneId: string,
    shotListId: string,
    shotIds: string[]
  ) {
    const project = await projectData.readCurrentProject({ homeDir });
    const mediaFolder = path.join(project!.projectFolder, 'generated', 'media');
    await fs.mkdir(mediaFolder, { recursive: true });
    for (const shotId of shotIds) {
      await fs.writeFile(path.join(mediaFolder, `${shotId}.png`), shotId);
    }
    return projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId,
      shotListId,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId,
        shots: shotIds.map((shotId) => ({
          shotId,
          source: `generated/media/${shotId}.png`,
        })),
      },
      idGenerator: createDeterministicIdGenerator(),
    });
  }

  async function createSelectedStoryboardLookbook() {
    const lookbook = await projectData.createLookbook({
      homeDir,
      document: {
        kind: 'storyboardLookbook',
        storyboardLookbook: {
          name: 'Graphite Storyboard',
          styleBrief: { text: 'Graphite storyboard frames with clear staging.' },
          lineAndFinish: { text: 'Loose pencil construction with crisp ink accents.' },
          valueAndAccent: { text: 'Soft gray values with restrained warm accents.' },
          guardrails: { text: 'Avoid photoreal stills and decorative text inside panels.' },
        },
        sourceMovieLookbookIds: [],
        sourceInspirationFolderIds: [],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      homeDir,
      type: 'storyboard',
      lookbookId: lookbook.lookbook.id,
    });
  }
});

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  title = 'Council chamber coverage',
  shotCount = 1
): SceneShotListDocument {
  const baseShot = {
    title: 'Map study',
    storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the scene.',
    description: 'Wide static shot of Mehmed at the table with the map visible.',
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'centered table composition',
    lensIntent: 'moderate wide lens feel',
    subject: 'Mehmed and the city map',
    action: 'Mehmed studies the map in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    audioNotes: 'Quiet room tone and paper movement.',
    productionNotes: 'Keep warm lamplight restrained.',
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title,
    summary: 'A restrained one-shot coverage plan for the first scene.',
    coverageStrategy:
      'Hold the map table and Mehmed in one composed frame to emphasize planning.',
    lookbookInfluence: 'Use the project aspect ratio unless a shot specifies otherwise.',
    shots: Array.from({ length: shotCount }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseShot.title : `Map study alternate ${index + 1}`,
    })),
  };
}
