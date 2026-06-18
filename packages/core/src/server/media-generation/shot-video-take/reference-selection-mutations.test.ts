import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('shot video take reference selection mutations', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('rejects blank character sheet asset ids without persisting them', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        castMemberId: ids.castMemberId,
        assetId: '',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA425',
    });

    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(take.state.referenceSelections.selectedCharacterSheetAssetIds).toEqual({});
  });

  it('rejects blank location sheet asset ids without persisting them', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeLocationSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        locationId: ids.locationId,
        assetId: '',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA427',
    });

    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(take.state.referenceSelections.selectedLocationSheetAssetIds).toEqual({});
  });

  it('rejects blank lookbook sheet ids without persisting them', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeLookbookSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        lookbookSheetId: '',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA429',
    });

    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(take.state.referenceSelections.selectedLookbookSheetIds).toEqual([]);
  });

  it('rejects blank dialogue audio take ids without persisting them', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const dialogueId = 'dialogue_blank_audio_take';
    await projectData.reviseScreenplayScene({
      homeDir,
      sceneId: ids.sceneId,
      document: {
        kind: 'screenplaySceneRevision',
        scene: {
          ...scene,
          blocks: [
            ...scene.blocks,
            {
              type: 'dialogue',
              dialogueId,
              castMemberId: ids.castMemberId,
              lines: ['Hold the gate.'],
            },
          ],
        },
      },
    });
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeDialogueAudioSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        dialogueId,
        dialogueAudioTakeId: '',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA431',
    });

    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(take.state.referenceSelections.selectedDialogueAudioTakeIds).toEqual({});
  });
});
