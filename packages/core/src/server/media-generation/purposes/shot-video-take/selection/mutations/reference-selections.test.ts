import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../../../../testing/shot-video-take-fixtures.js';
import { createDeterministicIdGenerator } from '../../../../../index.js';
import type {
  ProjectRelativePath,
  SceneShotVideoTake,
  SceneShotVideoTakeReferenceSelections,
} from '../../../../../../client/index.js';

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
    expect(takeReferenceSelections(take).selectedCharacterSheetAssetIds).toEqual({});
  });

  it('rejects character sheet assets from another Cast Member before writing take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/narrator-character-sheet.png',
      'narrator sheet'
    );
    const narratorSheet = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.narratorCastMemberId,
      sourceProjectRelativePath: 'generated/media/narrator-character-sheet.png',
    });

    await expect(
      projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        castMemberId: ids.castMemberId,
        assetId: narratorSheet.imported.assetId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA425',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ path: ['assetId'] }),
        }),
      ],
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedCharacterSheetAssetIds: {},
    });
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
    expect(takeReferenceSelections(take).selectedLocationSheetAssetIds).toEqual({});
  });

  it('rejects location sheets from another Location before writing take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'wrong-sheet-location',
              handle: 'wrong-sheet-location',
              name: 'Wrong Sheet Location',
              description: 'A different location used for stale sheet tests.',
            },
          },
        ],
      },
      idGenerator: {
        next(prefix) {
          return prefix === 'location'
            ? 'location_wrong_sheet_0079'
            : `${prefix}_wrong_sheet_0079`;
        },
      },
    });
    const projectResource = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const otherLocationId = projectResource.locations.find(
      (location) => location.handle === 'wrong-sheet-location'
    )?.id;
    if (!otherLocationId) {
      throw new Error('Expected wrong-sheet test location to exist.');
    }
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const sheetFiles = await shotVideoTakeProject.writeLocationSheetImportFiles(
      project.projectFolder,
      'wrong-location-sheet'
    );
    const otherLocationSheet =
      await projectData.importLocationEnvironmentSheetMedia({
        homeDir,
        locationId: otherLocationId,
        sourceProjectRelativePath: sheetFiles.primary,
        title: 'Wrong location sheet',
        description: 'A sheet attached to the wrong Location.',
      });

    await expect(
      projectData.updateSceneShotVideoTakeLocationSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        locationId: ids.locationId,
        assetId: otherLocationSheet.imported.assetId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA427',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ path: ['assetId'] }),
        }),
      ],
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedLocationSheetAssetIds: {},
    });
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
    expect(takeReferenceSelections(take).selectedLookbookSheetIds).toEqual([]);
  });

  it('rejects Lookbook sheets outside the active Lookbook before writing take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbookIds = createDeterministicIdGenerator();
    const activeLookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Active Lookbook',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: lookbookIds,
    });
    const inactiveLookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Inactive Lookbook',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: lookbookIds,
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: activeLookbook.lookbook.id,
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/inactive-lookbook-sheet.png',
      'inactive sheet'
    );
    const inactiveSheet = await projectData.importLookbookSheetMedia({
      homeDir,
      lookbookId: inactiveLookbook.lookbook.id,
      sourceProjectRelativePath: 'generated/media/inactive-lookbook-sheet.png',
      title: 'Inactive sheet',
    });

    await expect(
      projectData.updateSceneShotVideoTakeLookbookSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        lookbookSheetId: inactiveSheet.imported.id,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA429',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ path: ['lookbookSheetId'] }),
        }),
      ],
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedLookbookSheetIds: [],
    });
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
    expect(takeReferenceSelections(take).selectedDialogueAudioTakeIds).toEqual({});
  });

  it('rejects dialogue audio takes from another dialogue before writing take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    await shotVideoTakeProject.writeProjectFile(
      'generated/audio/urban-sample.mp3',
      'voice sample bytes'
    );
    const voice = await projectData.attachCastVoice({
      homeDir,
      document: {
        kind: 'castVoiceAttachment',
        castMemberId: ids.castMemberId,
        name: 'urban-primary',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceId: 'voice_urban_primary',
        purpose: 'Primary speaking voice for dialogue reference tests',
        sample: {
          sourceProjectRelativePath:
            'generated/audio/urban-sample.mp3' as ProjectRelativePath,
          title: 'Urban primary voice sample',
        },
      },
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const sourceDialogueId = 'dialogue_reference_source';
    const targetDialogueId = 'dialogue_reference_target';
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
              dialogueId: sourceDialogueId,
              castMemberId: ids.castMemberId,
              lines: ['The walls remember every hammer.'],
            },
            {
              type: 'dialogue',
              dialogueId: targetDialogueId,
              castMemberId: ids.castMemberId,
              lines: ['Then we teach them a new sound.'],
            },
          ],
        },
      },
    });
    const audio = await projectData.generateSceneDialogueAudioTake({
      homeDir,
      sceneId: ids.sceneId,
      dialogueId: sourceDialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: voice.voice.id,
        plainText: 'The walls remember every hammer.',
        v3Text: 'The walls remember every hammer.',
        outputFormat: 'mp3_44100_128',
        languageCode: 'en',
      },
      simulate: true,
    });
    const generatedAudio = audio.context.audioByDialogueId[sourceDialogueId];
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeDialogueAudioSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        dialogueId: targetDialogueId,
        dialogueAudioTakeId: generatedAudio!.takes[0]!.takeId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA431',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ path: ['takeId'] }),
        }),
      ],
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedDialogueAudioTakeIds: {},
    });
  });

  it('rejects unknown dependency inclusion ids before writing take state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeReferenceInclusion({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        dependencyId: 'reference-image:shot:shot_missing',
        inclusion: 'exclude',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA432',
      issues: [
        expect.objectContaining({
          location: expect.objectContaining({ path: ['dependencyId'] }),
        }),
      ],
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      dependencyInclusions: {},
    });
  });

  it('rejects continuous reference mutations that include a shot id', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        shotId: 'shot_001',
        castMemberId: ids.castMemberId,
        assetId: null,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedCharacterSheetAssetIds: {},
    });
  });

  it('continues editing on a new take when reference selections change after finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/source-reference-take.mp4',
      'source reference video'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/urban-character-sheet.png',
      'urban character sheet'
    );
    const characterSheet = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/urban-character-sheet.png',
      title: 'Urban character sheet',
    });
    await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/source-reference-take.mp4',
      title: 'Source reference take',
    });

    const continued =
      await projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        castMemberId: ids.castMemberId,
        assetId: characterSheet.imported.assetId,
      });

    expect(continued.take.takeId).not.toBe(written.take.takeId);
    expect(continued.take.regeneratedFromTakeId).toBe(written.take.takeId);
    expect(takeReferenceSelections(continued.take)).toMatchObject({
      selectedCharacterSheetAssetIds: {
        [ids.castMemberId]: characterSheet.imported.assetId,
      },
    });
    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedCharacterSheetAssetIds: {},
    });
  });

  it('rejects multi-cut reference mutations missing a shot id', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      mode: 'multi-cut',
    });

    await expect(
      projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        castMemberId: ids.castMemberId,
        assetId: null,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedCharacterSheetAssetIds: {},
    });
  });

  it('rejects multi-cut reference mutations with a foreign shot id', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      mode: 'multi-cut',
    });

    await expect(
      projectData.updateSceneShotVideoTakeCharacterSheetSelection({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        shotId: 'shot_foreign',
        castMemberId: ids.castMemberId,
        assetId: null,
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH',
    });

    await expect(readReferenceSelections(written.take.takeId)).resolves.toMatchObject({
      selectedCharacterSheetAssetIds: {},
    });
  });

  async function readReferenceSelections(takeId: string) {
    const ids = await shotVideoTakeProject.sampleIds();
    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
    });
    return takeReferenceSelections(take);
  }
});

function takeReferenceSelections(
  take: SceneShotVideoTake
): SceneShotVideoTakeReferenceSelections {
  if (take.state.structure.mode === 'continuous') {
    return take.state.structure.sharedDirection.referenceSelections!;
  }
  return take.state.structure.directionsByShotId[take.shotIds[0]!]!
    .referenceSelections!;
}
