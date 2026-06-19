import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

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
    const pickedTake = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      title: 'Picked take',
    });

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
    expect(report.takes[0]).toMatchObject({
      takeId: pickedTake.takeId,
      picked: true,
    });
    expect(report.takes.find((take) => take.takeId === written.take.takeId))
      .toMatchObject({ picked: false });
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
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA419' });
  });
});
