import Database from 'better-sqlite3';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';
import { createDeterministicIdGenerator } from '../../index.js';

describe('scene shot video takes', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('creates takes as unpicked by default and toggles take picks', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    expect(written.take.picked).toBe(false);

    const picked = await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: true,
    });
    expect(picked.take.picked).toBe(true);

    const cleared = await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: false,
    });
    expect(cleared.take.picked).toBe(false);
  });

  it('lists picked takes before unpicked takes', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const pickedTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      title: 'Picked take',
    });
    const pickedTake = pickedTakeReport.overview.take;
    expect(pickedTakeReport.resourceKeys).toEqual(
      expect.arrayContaining([
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${pickedTake.takeId}`,
      ])
    );

    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: pickedTake.takeId,
      picked: true,
    });

    const report = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(report.takes[0]?.take).toMatchObject({
      takeId: pickedTake.takeId,
      picked: true,
    });
    expect(
      report.takes.find(
        (overview) => overview.take.takeId === written.take.takeId
      )?.take
    ).toMatchObject({ picked: false });
  });

  it('returns source shot list storyboard images when creating a take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shot-001-storyboard.png',
      'shot one storyboard'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shot-002-storyboard.png',
      'shot two storyboard'
    );
    await projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId: written.shotList.id,
        shots: [
          {
            shotId: 'shot_001',
            source: 'generated/media/shot-001-storyboard.png',
          },
          {
            shotId: 'shot_002',
            source: 'generated/media/shot-002-storyboard.png',
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    const report = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      title: 'Storyboard-backed take',
    });

    expect(report.overview.take).toMatchObject({
      title: 'Storyboard-backed take',
      sourceShotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });
    expect(report.overview.sourceShotList.id).toBe(written.shotList.id);
    expect(report.overview.displayShots.map((shot) => shot.shotId)).toEqual([
      'shot_001',
      'shot_002',
    ]);
    expect(report.overview.storyboardImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shotId: 'shot_001',
          mediaKind: 'image',
        }),
      ])
    );
  });

  it('lists takes with broken shot membership as read-only instead of failing the scene list', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;

    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
      mode: 'multi-cut',
    });

    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const db = new Database(
      path.join(project.projectFolder, '.renku', 'project.sqlite')
    );
    try {
      db.prepare(
        'delete from scene_shot_video_take_shot where take_id = ?'
      ).run(takeId);
    } finally {
      db.close();
    }

    const report = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });
    const listedTake = report.takes.find(
      (overview) => overview.take.takeId === takeId
    )?.take;

    expect(listedTake).toMatchObject({
      takeId,
      shotIds: [],
      status: {
        editability: {
          state: 'read-only',
          diagnostics: [
            expect.objectContaining({
              code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SHOT_MEMBERSHIP',
            }),
          ],
        },
        runnability: {
          state: 'blocked',
        },
      },
    });
    await expect(
      projectData.updateSceneShotVideoTakePick({
        homeDir,
        sceneId: ids.sceneId,
        takeId,
        picked: true,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA420',
      issues: [
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SHOT_MEMBERSHIP',
        }),
      ],
    });
  });

  it('rejects wrong-scene take pick updates before changing the take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakePick({
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        picked: true,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });

    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).resolves.toMatchObject({ picked: false });
  });

  it('continues editing on a new take when production settings change after finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-production-prompt-sheet.png',
      'first production prompt sheet'
    );
    await projectData.importShotVideoPromptSheet({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-production-prompt-sheet.png',
      title: 'First production prompt sheet',
    });
    const sourceTakeWithPromptSheet = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
        customPromptNote: 'First finished-video settings.',
      },
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-production-take.mp4',
      'first production video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-production-take.mp4',
      title: 'First production take',
    });

    const continued = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
        customPromptNote: 'Tighter second-attempt settings.',
      },
    });

    expect(continued.take.takeId).not.toBe(sourceTakeId);
    expect(continued.take.regeneratedFromTakeId).toBe(sourceTakeId);
    expect(continued.take.video).toBeNull();
    expect(continued.take.state.production.customPromptNote).toBe(
      'Tighter second-attempt settings.'
    );
    expect(continued.take.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);
    expect(continued.take.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);
    expect(continued.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-video-take:${sourceTakeId}`,
        `scene-shot-video-take:${continued.take.takeId}`,
        `scene-shot-video-take-video:${sourceTakeId}`,
        `surface:scene:${ids.sceneId}:takes`,
      ])
    );

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    expect(sourceTake.video).toMatchObject({
      projectRelativePath: 'generated/media/first-production-take.mp4',
    });
    expect(sourceTake.state.production.customPromptNote).toBe(
      'First finished-video settings.'
    );
    expect(sourceTake.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
    expect(sourceTake.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
  });

  it('continues editing on a new take when composition changes after finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      direction: {
        composition: {
          shotSize: 'wide-shot',
          customComposition: 'Hold the whole council chamber in the frame.',
        },
      },
    });
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
      },
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-composition-take.mp4',
      'first composition video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-composition-take.mp4',
      title: 'First composition take',
    });

    const continued = await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      direction: {
        composition: {
          shotSize: 'close-up',
          customComposition: 'Move into Mehmed and let the map fall soft.',
        },
      },
    });

    expect(continued.take.takeId).not.toBe(sourceTakeId);
    expect(continued.take.regeneratedFromTakeId).toBe(sourceTakeId);
    expect(
      continued.take.state.structure.mode === 'continuous'
        ? continued.take.state.structure.sharedDirection.composition
        : undefined
    ).toMatchObject({
      shotSize: 'close-up',
      customComposition: 'Move into Mehmed and let the map fall soft.',
    });
    expect(continued.take.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    expect(sourceTake.video).toMatchObject({
      projectRelativePath: 'generated/media/first-composition-take.mp4',
    });
    expect(
      sourceTake.state.structure.mode === 'continuous'
        ? sourceTake.state.structure.sharedDirection.composition
        : undefined
    ).toMatchObject({
      shotSize: 'wide-shot',
      customComposition: 'Hold the whole council chamber in the frame.',
    });
    expect(sourceTake.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
  });

  it('deletes editable takes through core-owned take deletion', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const report = await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });

    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${written.take.takeId}`,
      ])
    );
    expect(report.recovery.trashItemIds).toHaveLength(1);
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA419' });
  });

  it('restores a previously picked take as unpicked when another active take is picked', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: true,
    });
    const discarded = await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    const replacementReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      title: 'Replacement picked take',
    });
    const replacement = replacementReport.overview.take;
    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: replacement.takeId,
      picked: true,
    });

    const restored = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery.restoreCommand.trashItemId,
    });

    expect(restored.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_DATA279',
        severity: 'warning',
      }),
    ]);
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).resolves.toMatchObject({ picked: false });
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: replacement.takeId,
      })
    ).resolves.toMatchObject({ picked: true });
  });
});
