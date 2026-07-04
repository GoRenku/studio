import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../../../testing/shot-video-take-fixtures.js';

describe('Shot Video Take authoring documents', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('validates and applies current take authoring documents through core', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;

    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId,
    });

    expect(context.kind).toBe('sceneShotVideoTakeAuthoringContext');
    expect(context.document).toMatchObject({
      kind: 'sceneShotVideoTakeAuthoring',
      takeId,
      sceneId: ids.sceneId,
      sourceShotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });
    expect(context.context.target).toMatchObject({
      takeId,
      shotIds: ['shot_001', 'shot_002'],
    });
    expect(context.productionPlan.plan.request).toMatchObject({
      sceneId: ids.sceneId,
      takeId,
    });
    expect(typeof context.providerPreview.available).toBe('boolean');

    const document = {
      ...context.document,
      shotIds: ['shot_001'],
    };
    const validation = await projectData.validateSceneShotVideoTakeAuthoringDocument({
      homeDir,
      document,
    });
    expect(validation).toMatchObject({
      valid: true,
      document: {
        takeId,
        shotIds: ['shot_001'],
      },
      prior: {
        document: {
          takeId,
          shotIds: ['shot_001', 'shot_002'],
        },
      },
      current: {
        document: {
          takeId,
          shotIds: ['shot_001'],
        },
        context: {
          take: {
            shotIds: ['shot_001'],
          },
          shotGroupMode: 'single-shot',
        },
      },
    });

    const applied = await projectData.applySceneShotVideoTakeAuthoringDocument({
      homeDir,
      document,
    });
    expect(applied).toMatchObject({
      valid: true,
      document: {
        takeId,
        shotIds: ['shot_001'],
      },
      project: {
        name: 'constantinople',
        projectFolder: expect.any(String),
      },
      prior: {
        document: {
          shotIds: ['shot_001', 'shot_002'],
        },
      },
      current: {
        document: {
          shotIds: ['shot_001'],
        },
      },
      resourceKeys: expect.arrayContaining([
        `scene:${ids.sceneId}`,
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${takeId}`,
      ]),
    });

    const reread = await projectData.readSceneShotVideoTake({ homeDir, takeId });
    expect(reread.shotIds).toEqual(['shot_001']);
  });

  it('validation reports proposed production state instead of persisted production state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });

    const validation = await projectData.validateSceneShotVideoTakeAuthoringDocument({
      homeDir,
      document: {
        ...context.document,
        shotIds: ['shot_001'],
        production: {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/kling-video/v3/pro',
        },
      },
    });

    expect(validation.prior.preflight).toMatchObject({
      inputModeId: 'first-frame',
      shotGroupMode: 'multi-shot',
    });
    expect(validation.current.preflight).toMatchObject({
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/kling-video/v3/pro',
      shotGroupMode: 'single-shot',
    });
    expect(validation.current.productionPlan.plan.request).toMatchObject({
      inputMode: 'text-only',
      modelChoice: 'fal-ai/kling-video/v3/pro',
      shotGroupMode: 'single-shot',
    });
  });

  it('rejects unsupported route combinations with structured diagnostics', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.validateSceneShotVideoTakeAuthoringDocument({
        homeDir,
        document: {
          ...context.document,
          production: {
            inputModeId: 'source-video-reference',
            modelChoice: 'fal-ai/bytedance/seedance-2.0',
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED',
        }),
      ]),
    });
  });

  it('rejects non-contiguous authoring shot ids during validation', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 3);
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.validateSceneShotVideoTakeAuthoringDocument({
        homeDir,
        document: {
          ...context.document,
          shotIds: ['shot_001', 'shot_003'],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOTS_NOT_CONTIGUOUS',
        }),
      ]),
    });
  });

  it('applies multi-cut documents without requiring caller-selected shot scope', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;
    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      takeId,
      mode: 'multi-cut',
    });
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId,
      selectedShotId: 'shot_002',
    });

    const applied = await projectData.applySceneShotVideoTakeAuthoringDocument({
      homeDir,
      document: {
        ...context.document,
        structure: {
          mode: 'multi-cut',
          directionsByShotId:
            context.document.structure.mode === 'multi-cut'
              ? {
                  ...context.document.structure.directionsByShotId,
                  shot_001: {
                    ...context.document.structure.directionsByShotId.shot_001,
                    composition: { shotSize: 'wide-shot' },
                  },
                  shot_002: {
                    ...context.document.structure.directionsByShotId.shot_002,
                    composition: { shotSize: 'close-up' },
                  },
                }
              : {},
        },
      },
    });

    expect(applied.prior.document.structure.mode).toBe('multi-cut');
    expect(applied.current.document.structure.mode).toBe('multi-cut');
    expect(applied.current.productionPlan.take.shotIds).toEqual([
      'shot_001',
      'shot_002',
    ]);
    expect(applied.current.productionPlan.references).toBeDefined();
  });

  it('applies authoring documents to a new take when the source take already has video', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/authored-source-prompt-sheet.png',
      'authored source prompt sheet'
    );
    await projectData.importShotVideoPromptSheet({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/authored-source-prompt-sheet.png',
      title: 'Authored source prompt sheet',
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/authored-source-take.mp4',
      'authored source video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/authored-source-take.mp4',
      title: 'Authored source take',
    });
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: sourceTakeId,
    });

    const applied = await projectData.applySceneShotVideoTakeAuthoringDocument({
      homeDir,
      document: {
        ...context.document,
        shotIds: ['shot_001'],
        production: {
          ...context.document.production,
          requestedInputs: [
            {
              kind: 'video-prompt-sheet',
              subjectKind: 'take',
              subjectId: sourceTakeId,
            },
          ],
          customPromptNote: 'Second attempt authored by the agent.',
        },
      },
    });

    const targetTakeId = applied.current.context.take.takeId;
    expect(targetTakeId).not.toBe(sourceTakeId);
    expect(applied.document).toMatchObject({
      takeId: targetTakeId,
      shotIds: ['shot_001'],
      production: {
        requestedInputs: [
          expect.objectContaining({
            subjectKind: 'take',
            subjectId: targetTakeId,
          }),
        ],
        preparedInputs: [
          expect.objectContaining({
            subjectKind: 'take',
            subjectId: targetTakeId,
          }),
        ],
        customPromptNote: 'Second attempt authored by the agent.',
      },
    });
    expect(applied.current.context.take).toMatchObject({
      takeId: targetTakeId,
      regeneratedFromTakeId: sourceTakeId,
      video: null,
      shotIds: ['shot_001'],
    });
    expect(applied.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-video-take:${sourceTakeId}`,
        `scene-shot-video-take:${targetTakeId}`,
        `scene-shot-video-take-video:${sourceTakeId}`,
        `surface:scene:${ids.sceneId}:takes`,
      ])
    );

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
    });
    expect(sourceTake.video).toMatchObject({
      projectRelativePath: 'generated/media/authored-source-take.mp4',
    });
    expect(sourceTake.shotIds).toEqual(['shot_001', 'shot_002']);
  });

  it('rejects stale authoring documents instead of overwriting newer take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;
    const context = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId,
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        customPromptNote: 'Newer production note.',
      },
    });

    await expect(
      projectData.applySceneShotVideoTakeAuthoringDocument({
        homeDir,
        document: {
          ...context.document,
          shotIds: ['shot_001'],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_DOCUMENT',
    });

    const reread = await projectData.readSceneShotVideoTake({ homeDir, takeId });
    expect(reread.shotIds).toEqual(['shot_001', 'shot_002']);
  });
});
