import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('shot video take preflight and validation', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-video-take-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('reports every requested input slot as a missing required dependency', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        intentId: 'text-only',
        modelChoice: 'fal-ai/xai/grok-imagine-video/text-to-video',
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
            kind: 'reference-image',
            subjectKind: 'lookbook',
            subjectId: 'lookbook_test',
          },
        ],
      },
    });

    expect(preflight.valid).toBe(false);
    expect(preflight.inputsToCreate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputInputKind: 'character-sheet',
          subjectKind: 'cast-member',
          subjectId: ids.castMemberId,
          mediaKind: 'image',
        }),
        expect.objectContaining({
          outputInputKind: 'location-sheet',
          subjectKind: 'location',
          subjectId: ids.locationId,
          mediaKind: 'image',
        }),
        expect.objectContaining({
          outputInputKind: 'reference-image',
          subjectKind: 'lookbook',
          subjectId: 'lookbook_test',
          mediaKind: 'image',
        }),
      ])
    );
    expect(preflight.finalTake.canCreateSpec).toBe(false);
  });

  it('rejects a multi-shot final spec without the required storyboard sheet', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 2);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          intentId: 'multi-shot',
          modelChoice: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
          prompt: 'One continuous two-shot video take.',
          parameterValues: {},
          inputs: [],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA384',
      message: expect.stringContaining('multi-shot-storyboard-sheet'),
    });
  });

  it('preserves imported input file paths in preflight prepared inputs', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/first-frame.png';
    await writeProjectFile(sourceProjectRelativePath, 'first frame');

    await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      sourceProjectRelativePath,
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
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

  it('resolves prepared cast sheet inputs without a shot video take input row', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 1);
    const sheetSource = 'generated/media/cast-sheet.png';
    await writeProjectFile(sheetSource, 'cast sheet');
    const characterSheet = await projectData.importCastCharacterSheetMedia({
      homeDir,
      castMemberId: ids.castMemberId,
      sourceProjectRelativePath: sheetSource,
    });
    const primaryFile = characterSheet.imported.files[0]!;

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        intentId: 'text-only',
        modelChoice: 'fal-ai/xai/grok-imagine-video/text-to-video',
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

    expect(preflight.inputsToCreate).toEqual([]);
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

  it('validates selected input ownership before mutating another group selection', async () => {
    const ids = await sampleIds();
    const written = await writeShotList(ids, 2);
    await writeProjectFile('generated/media/group-two-a.png', 'first frame a');
    await writeProjectFile('generated/media/group-two-b.png', 'first frame b');
    const selected = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      sourceProjectRelativePath: 'generated/media/group-two-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotFirstFrame({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      sourceProjectRelativePath: 'generated/media/group-two-b.png',
      selection: 'take',
    });

    await expect(
      projectData.selectShotVideoTakeInput({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        shotIds: ['shot_001'],
        inputId: unselected.input.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA362' });

    const groupTwoInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
    });
    expect(groupTwoInputs.inputs.find((input) => input.inputId === selected.input.inputId))
      .toMatchObject({ selected: true });
    expect(groupTwoInputs.inputs.find((input) => input.inputId === unselected.input.inputId))
      .toMatchObject({ selected: false });
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

  async function writeShotList(
    ids: { sceneId: string; castMemberId: string; locationId: string },
    shotCount: number
  ) {
    return projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, shotCount),
      idGenerator: createDeterministicIdGenerator(),
    });
  }

  async function writeProjectFile(
    projectRelativePath: string,
    contents: string
  ): Promise<void> {
    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const absolutePath = path.join(project.projectFolder, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
});

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  shotCount: number
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
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
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
