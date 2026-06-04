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

  it('validates Composition and Location shot specs fields', async () => {
    const ids = await sampleIds();
    const valid = sampleShotList(ids);
    const extended: SceneShotListDocument = {
      ...valid,
      shots: [
        {
          ...valid.shots[0]!,
          shotSpecs: {
            shotSize: 'wide-shot',
            subjectFraming: ['single'],
            lens: {
              type: 'wide',
              millimeters: 28,
              focus: 'rack-focus',
            },
            movement: { movement: 'rack-focus' },
            location: {
              locationId: ids.locationId,
              azimuthView: 'front',
            },
            custom: {
              composition: 'hold the map edge in the lower foreground',
            },
          },
        },
      ],
    };

    await expect(
      projectData.validateSceneShotList({ homeDir, document: extended })
    ).resolves.toMatchObject({ valid: true });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                custom: {
                  framing: 'obsolete custom field',
                } as unknown as NonNullable<
                  NonNullable<
                    SceneShotListDocument['shots'][number]['shotSpecs']
                  >['custom']
                >,
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Unknown field'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                lens: {
                  type: 'wide',
                  matteBox: true,
                } as unknown as NonNullable<
                  NonNullable<
                    SceneShotListDocument['shots'][number]['shotSpecs']
                  >['lens']
                >,
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Unknown field'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                lens: {
                  millimeters: 28,
                },
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
                  message: expect.stringContaining('requires a lens type'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                lens: { type: 'wide', focus: 'deep-focus' },
                movement: { movement: 'rack-focus' },
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('requires rack-focus'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                location: {
                  locationId: 'location_elsewhere',
                },
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('unknown project location'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                castReferences: {
                  castMemberIds: ['cast_elsewhere'],
                },
              },
            },
          ],
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
          ...extended,
          shots: [
            {
              ...extended.shots[0]!,
              locationIds: [],
              shotSpecs: {
                ...extended.shots[0]!.shotSpecs!,
                location: {
                  locationId: ids.locationId,
                  azimuthView: 'front',
                },
              },
            },
          ],
        },
      })
    ).resolves.toMatchObject({ valid: true });
  });

  it('validates shot video take production groups', async () => {
    const ids = await sampleIds();
    const valid = {
      ...sampleShotList(ids, 'Grouped video take coverage', 3),
      videoTakeProductionGroups: [
        {
          productionGroupId: 'scene_shot_video_take_group_001',
          shotIds: ['shot_001'],
          videoTakeProduction: {
            inputModeId: 'first-last-frame',
            modelChoice: 'fal-ai/veo3.1',
            parameterValues: { duration: '6s' },
          },
        },
        {
          productionGroupId: 'scene_shot_video_take_group_002',
          shotIds: ['shot_002', 'shot_003'],
          videoTakeProduction: {
            inputModeId: 'reference',
            modelChoice: 'fal-ai/bytedance/seedance-2.0',
          },
        },
      ],
    } satisfies SceneShotListDocument;

    await expect(
      projectData.validateSceneShotList({ homeDir, document: valid })
    ).resolves.toMatchObject({ valid: true });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          videoTakeProductionGroups: [
            valid.videoTakeProductionGroups[0]!,
            {
              ...valid.videoTakeProductionGroups[1]!,
              shotIds: ['shot_001', 'shot_003'],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('more than one video take production group'),
        }),
        expect.objectContaining({
          message: expect.stringContaining('contiguous'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          videoTakeProductionGroups: [
            {
              ...valid.videoTakeProductionGroups[0]!,
              videoTakeProduction: {
                inputModeId: 'multi-shot',
              },
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining(
            'Unsupported value at videoTakeProductionGroups.0.videoTakeProduction.inputModeId'
          ),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          videoTakeProductionGroups: [
            {
              productionGroupId: 'scene_shot_video_take_group_003',
              shotIds: ['shot_001'],
              videoTakeProduction: {
                unexpectedField: true,
              } as never,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Unknown field'),
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

  it('imports one compound storyboard sheet asset with per-shot images', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    const project = await projectData.readCurrentProject({ homeDir });
    expect(project).not.toBeNull();
    const sheetPath = path.join(
      project!.projectFolder,
      'generated',
      'media',
      'sheet.png'
    );
    const shotPath = path.join(
      project!.projectFolder,
      'generated',
      'media',
      'shot.png'
    );
    await fs.mkdir(path.dirname(sheetPath), { recursive: true });
    await fs.writeFile(sheetPath, 'sheet');
    await fs.writeFile(shotPath, 'shot');

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [
            {
              source: 'generated/media/sheet.png',
              shots: [
                {
                  shotId: 'shot_001',
                  source: 'generated/media/missing-shot.png',
                },
              ],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA342',
    });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [
            {
              source: 'generated/media/sheet.png',
              shots: [
                { shotId: 'shot_missing', source: 'generated/media/shot.png' },
              ],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA325',
    });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [{ source: 'generated/media/sheet.png', shots: [] }],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA337',
    });

    const report = await projectData.importSceneStoryboardSheetMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardSheetImport',
        sheets: [
          {
            source: 'generated/media/sheet.png',
            shots: [{ shotId: 'shot_001', source: 'generated/media/shot.png' }],
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.imported.type).toBe('scene_storyboard_sheet');
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'sheet' }),
        expect.objectContaining({ role: 'shot', shotId: 'shot_001' }),
      ])
    );
    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_001`,
      ])
    );
  });

  it('imports a partial storyboard sheet for a longer shot list', async () => {
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
    await fs.writeFile(path.join(mediaFolder, 'sheet.png'), 'sheet');
    await fs.writeFile(path.join(mediaFolder, 'shot-001.png'), 'shot 1');
    await fs.writeFile(path.join(mediaFolder, 'shot-002.png'), 'shot 2');

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [
            {
              source: 'generated/media/sheet.png',
              shots: [
                { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
                { shotId: 'shot_001', source: 'generated/media/shot-002.png' },
              ],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA336',
    });

    const report = await projectData.importSceneStoryboardSheetMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardSheetImport',
        sheets: [
          {
            source: 'generated/media/sheet.png',
            shots: [
              { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
              { shotId: 'shot_002', source: 'generated/media/shot-002.png' },
            ],
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'sheet' }),
        expect.objectContaining({ role: 'shot', shotId: 'shot_001' }),
        expect.objectContaining({ role: 'shot', shotId: 'shot_002' }),
      ])
    );
    expect(report.files).toHaveLength(3);
    expect(report.resourceKeys).toEqual(
      expect.not.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_005`,
      ])
    );
  });

  it('imports multiple storyboard sheets as one grouped scene storyboard asset', async () => {
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
      'sheet-1.png',
      'sheet-2.png',
      'shot-001.png',
      'shot-002.png',
      'shot-005.png',
    ]) {
      await fs.writeFile(path.join(mediaFolder, filename), filename);
    }

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          title: 'Grouped storyboard package',
          sheets: [],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA337' });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [{ source: 'generated/media/sheet-1.png', shots: [] }],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA337' });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [
            {
              source: 'generated/media/sheet-1.png',
              shots: [{ shotId: 'shot_001', source: 'generated/media/shot-001.png' }],
            },
            {
              source: 'generated/media/sheet-2.png',
              shots: [{ shotId: 'shot_001', source: 'generated/media/shot-002.png' }],
            },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA336' });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheets: [
            {
              source: 'generated/media/sheet-1.png',
              shots: [{ shotId: 'shot_001', source: 'generated/media/sheet-1.png' }],
            },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA338' });

    const report = await projectData.importSceneStoryboardSheetMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardSheetImport',
        title: 'Grouped storyboard package',
        sheets: [
          {
            source: 'generated/media/sheet-1.png',
            title: 'Shots 1-2',
            shots: [
              { shotId: 'shot_001', source: 'generated/media/shot-001.png' },
              { shotId: 'shot_002', source: 'generated/media/shot-002.png' },
            ],
          },
          {
            source: 'generated/media/sheet-2.png',
            title: 'Shot 5',
            shots: [{ shotId: 'shot_005', source: 'generated/media/shot-005.png' }],
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.imported.type).toBe('scene_storyboard_sheet');
    expect(report.storyboardSheetIds).toHaveLength(2);
    expect(report.storyboardSheetId).toBe(report.storyboardSheetIds[0]);
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'sheet', sheetIndex: 1 }),
        expect.objectContaining({ role: 'sheet', sheetIndex: 2 }),
        expect.objectContaining({ role: 'shot', sheetIndex: 1, shotId: 'shot_001' }),
        expect.objectContaining({ role: 'shot', sheetIndex: 1, shotId: 'shot_002' }),
        expect.objectContaining({ role: 'shot', sheetIndex: 2, shotId: 'shot_005' }),
      ])
    );
    expect(report.files).toHaveLength(5);
    expect(new Set(report.files.map((file) => path.dirname(file.projectRelativePath))).size).toBe(1);
    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-list:${written.shotList.id}:storyboard-sheet:${report.storyboardSheetIds[0]}`,
        `scene-shot-list:${written.shotList.id}:storyboard-sheet:${report.storyboardSheetIds[1]}`,
        `scene-shot-list:${written.shotList.id}:shot:shot_005`,
      ])
    );

    const sqlite = new Database(
      path.join(project!.projectFolder, '.renku', 'project.sqlite')
    );
    try {
      const sheets = sqlite
        .prepare(
          'select id, asset_id from scene_shot_storyboard_sheet where asset_id = ? order by created_at, id'
        )
        .all(report.imported.assetId) as Array<{ id: string; asset_id: string }>;
      expect(sheets.map((sheet) => sheet.id)).toEqual(report.storyboardSheetIds);
      const firstSheetImages = sqlite
        .prepare(
          'select shot_id from scene_shot_storyboard_image where storyboard_sheet_id = ? order by position'
        )
        .all(report.storyboardSheetIds[0]) as Array<{ shot_id: string }>;
      const secondSheetImages = sqlite
        .prepare(
          'select shot_id from scene_shot_storyboard_image where storyboard_sheet_id = ? order by position'
        )
        .all(report.storyboardSheetIds[1]) as Array<{ shot_id: string }>;
      expect(firstSheetImages.map((row) => row.shot_id)).toEqual([
        'shot_001',
        'shot_002',
      ]);
      expect(secondSheetImages.map((row) => row.shot_id)).toEqual(['shot_005']);
    } finally {
      sqlite.close();
    }
  });

  it('validates scene storyboard sheet specs and preserves binding options', async () => {
    const ids = await sampleIds();
    const overrideLocationId = await addFlashbackLocation();
    const shotList = sampleShotList(ids, 'Longer coverage', 5);
    shotList.shots[0] = {
      ...shotList.shots[0]!,
      shotSpecs: {
        location: {
          locationId: overrideLocationId,
          azimuthView: 'right',
        },
      },
    };
    shotList.shots[1] = {
      ...shotList.shots[1]!,
      shotSpecs: {
        location: {
          locationId: ids.locationId,
          azimuthView: 'left',
        },
      },
    };
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: shotList,
      idGenerator: createDeterministicIdGenerator(),
    });

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
      `location: Golden Horn overlook (${overrideLocationId}); view: Right`
    );
    expect(validation.providerPayload.prompt).toContain(
      `location: Mehmed's council chamber (${ids.locationId}); view: Left`
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
    await projectData.applyScreenplayOperations({
      homeDir,
      document: {
        kind: 'screenplayOperations',
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
