import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('reports requested input slots as non-blocking dependency suggestions', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: '5',
          aspect_ratio: '16:9',
          resolution: '720p',
        },
        requestedInputs: [
          {
            kind: 'character-sheet',
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
          {
            kind: 'location-sheet',
            subjectKind: 'location',
            subjectId: ids.locationId,
          },
          {
            kind: 'lookbook-sheet',
            subjectKind: 'lookbook',
            subjectId: 'lookbook_test',
          },
        ],
      },
    });

    expect(preflight.valid).toBe(true);
    expect(preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          mediaKind: 'image',
          required: false,
        }),
        expect.objectContaining({
          outputInputKind: 'location-sheet',
          subjectKind: 'location',
          subjectId: ids.locationId,
          mediaKind: 'image',
          required: false,
        }),
        expect.objectContaining({
          outputInputKind: 'lookbook-sheet',
          subjectKind: 'lookbook',
          subjectId: 'lookbook_test',
          mediaKind: 'image',
          required: false,
        }),
      ])
    );
    expect(preflight.finalTake.canCreateSpec).toBe(true);

    const created = await projectData.createMediaGenerationSpec({
      homeDir,
      spec: {
        purpose: 'shot.video-take',
        target: preflight.target,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        prompt: 'Generate the video take without optional visual references.',
        parameterValues: { duration: 6 },
        inputs: [],
        title: 'Text-only take with optional references ignored',
      },
    });
    expect(created).toMatchObject({
      purpose: 'shot.video-take',
      target: preflight.target,
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'character-sheet',
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
        ],
        agentProposal: {
          basedOnInputModeId: 'text-only',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [],
          finalPromptDraft: {
            prompt: 'Generate the video take without optional visual references.',
          },
        },
      },
    });
    const authoringContext = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(authoringContext.preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          required: false,
        }),
      ])
    );
    expect(authoringContext.takeGenerationReadiness.requiredBlockers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'missing-dependency-draft',
        }),
      ])
    );
  });

  it('reports missing route-required video prompt sheets as readiness blockers', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        agentProposal: {
          basedOnInputModeId: 'reference',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [],
          finalPromptDraft: {
            prompt: 'Generate one continuous two-shot video take.',
          },
        },
      },
    });

    const authoringContext = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });

    expect(authoringContext.preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'video-prompt-sheet',
          required: true,
        }),
      ])
    );
    expect(authoringContext.preflight.finalTake.canCreateSpec).toBe(false);
    expect(authoringContext.takeGenerationReadiness).toMatchObject({
      status: 'blocked',
      requiredBlockers: expect.arrayContaining([
        expect.objectContaining({
          kind: 'missing-video-prompt-sheet',
          recommendedSpecialist: 'media-producer',
          recommendedCommand: `renku generation context --purpose shot.video-prompt-sheet --target take:${written.take.takeId} --json`,
        }),
      ]),
    });
  });

  it('preserves imported input file paths in preflight prepared inputs', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/first-frame.png';
    await shotVideoTakeProject.writeProjectFile(sourceProjectRelativePath, 'first frame');

    await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath,
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
    });

    expect(preflight.preparedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'first-frame',
          projectRelativePath: sourceProjectRelativePath,
        }),
      ])
    );
  });

  it('uses core defaults as the selected model in agent-facing readiness', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const authoringContext = await projectData.readSceneShotVideoTakeAuthoringContext({
      homeDir,
      takeId: written.take.takeId,
    });

    expect(authoringContext.preflight).toMatchObject({
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
    });
    expect(authoringContext.preflight.agentBrief).toContain(
      'Model: fal-ai/bytedance/seedance-2.0'
    );
    expect(authoringContext.takeGenerationReadiness.requiredBlockers).not.toContainEqual(
      expect.objectContaining({ kind: 'missing-input-mode' })
    );
    expect(authoringContext.takeGenerationReadiness.requiredBlockers).not.toContainEqual(
      expect.objectContaining({ kind: 'missing-model' })
    );
  });

  it('keeps missing take-reference sheet selections visible beside prepared cast sheet inputs', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sheetSource = 'generated/media/cast-sheet.png';
    await shotVideoTakeProject.writeProjectFile(sheetSource, 'cast sheet');
    const characterSheet = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: sheetSource,
    });
    const primaryFile = characterSheet.imported.files[0]!;

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'character-sheet',
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
        ],
        preparedInputs: [
          {
            kind: 'character-sheet',
            assetId: characterSheet.imported.assetId,
            assetFileId: primaryFile.id,
            subjectKind: 'cast-member',
            subjectId: ids.castMemberId,
          },
        ],
      },
    });

    expect(preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
        }),
      ])
    );
    expect(preflight.preparedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          projectRelativePath: primaryFile.projectRelativePath,
        }),
      ])
    );
  });
});
