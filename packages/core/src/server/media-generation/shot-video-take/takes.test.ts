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
