import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';
import type { SceneShotWithLegacyShotSpecs } from '../../../client/index.js';

describe('shot video take generation shot membership', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('keeps prepared production inputs when membership does not change', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId,
      production: {
        inputModeId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        customPromptNote: 'Hold the cannon smoke low.',
        preparedInputs: [
          {
            kind: 'reference-image',
            assetId: 'asset_reference',
            assetFileId: 'asset_file_reference',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
      },
    });

    const context = await projectData.updateSceneShotVideoTakeShots({
      homeDir,
      takeId,
      shotIds: ['shot_001'],
    });

    expect(context.take.production).toMatchObject({
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      customPromptNote: 'Hold the cannon smoke low.',
      preparedInputs: [
        {
          kind: 'reference-image',
          assetId: 'asset_reference',
          assetFileId: 'asset_file_reference',
          subjectKind: 'shot',
          subjectId: 'shot_001',
        },
      ],
    });
  });

  it('copies settings on split and marks copied prompts stale for new shot ids', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 3);
    const takeId = written.take.takeId;

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 9 },
        requestedInputs: [
          {
            kind: 'reference-image',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
          {
            kind: 'reference-image',
            subjectKind: 'shot',
            subjectId: 'shot_003',
          },
        ],
        preparedInputs: [
          {
            kind: 'first-frame',
            assetId: 'asset_old',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [],
          finalPromptDraft: { prompt: 'Original three-shot prompt.' },
        },
      },
    });

    const context = await projectData.updateSceneShotVideoTakeShots({
      homeDir,
      takeId,
      shotIds: ['shot_003'],
    });

    expect(context.take.shotIds).toEqual(['shot_003']);
    expect(context.take.production).toMatchObject({
      inputModeId: 'first-frame',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: { duration: 9 },
      requestedInputs: [
        {
          kind: 'reference-image',
          subjectKind: 'shot',
          subjectId: 'shot_003',
        },
      ],
      agentProposal: {
        basedOnShotIds: ['shot_001', 'shot_002', 'shot_003'],
        finalPromptDraft: { prompt: 'Original three-shot prompt.' },
      },
    });
    expect(context.take.production.preparedInputs).toBeUndefined();

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      takeId,
    });
    expect(estimate.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA378' }),
      ])
    );
  });

  it('keeps open take generation settings when membership expands like a merge', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 5);
    const take = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId: take.takeId,
      production: {
        inputModeId: 'text-only',
        customPromptNote: 'Open take generation settings win.',
      },
    });

    const context = await projectData.updateSceneShotVideoTakeShots({
      homeDir,
      takeId: take.takeId,
      shotIds: ['shot_001', 'shot_002', 'shot_003', 'shot_004', 'shot_005'],
    });

    expect(context.take.production).toMatchObject({
      inputModeId: 'text-only',
      customPromptNote: 'Open take generation settings win.',
    });
  });



  it('keeps a take editable after the active shot list changes', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;

    await projectData.writeSceneShotList({
      homeDir,
      document: {
        ...shotVideoTakeProject.sampleShotList(ids, 1),
        title: 'Replacement active coverage',
      },
    });

    const context = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      takeId,
      production: { inputModeId: 'text-only' },
    });

    expect(context.take.status.editability.state).toBe('editable');
    expect(context.take.status.history.differences).toContain(
      'active-shot-list-changed'
    );
    expect(context.take.production.inputModeId).toBe('text-only');
    expect(context.take.state.production.inputModeId).toBe('text-only');
  });

  it('reads a take edit context from the source shot list after the active shot list changes', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;

    await projectData.updateSceneShotVideoTakeShotSpecs({
      homeDir,
      takeId,
      shotId: 'shot_001',
      shotSpecs: { shotSize: 'close-up' },
    });
    await projectData.writeSceneShotList({
      homeDir,
      document: {
        ...shotVideoTakeProject.sampleShotList(ids, 1),
        title: 'Replacement active coverage',
      },
    });

    const editContext = await projectData.readSceneShotVideoTakeEditContext({
      homeDir,
      takeId,
    });

    expect(editContext.take.takeId).toBe(takeId);
    expect(editContext.sourceShotList.id).toBe(written.shotList.id);
    expect(editContext.sourceShotList.isActive).toBe(false);
    expect(editContext.sourceShots.map((shot) => shot.shotId)).toEqual([
      'shot_001',
    ]);
    expect(
      (editContext.sourceShots[0] as SceneShotWithLegacyShotSpecs | undefined)
        ?.shotSpecs?.shotSize
    ).toBe('close-up');
    expect(editContext.take.status.history.differences).toContain(
      'active-shot-list-changed'
    );
    expect(editContext.assetReadiness).toMatchObject({
      selectedInputCount: 0,
      readyInputCount: 0,
      missingInputCount: 0,
    });
  });

  it('lets two takes over the same shot keep different composition state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const firstTakeId = written.take.takeId;
    const secondTake = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });

    const firstContext =
      await projectData.updateSceneShotVideoTakeShotSpecs({
        homeDir,
        takeId: firstTakeId,
        shotId: 'shot_001',
        shotSpecs: { shotSize: 'close-up' },
      });
    const secondContext =
      await projectData.updateSceneShotVideoTakeShotSpecs({
        homeDir,
        takeId: secondTake.takeId,
        shotId: 'shot_001',
        shotSpecs: { shotSize: 'wide-shot' },
      });

    expect(
      firstContext.take.state.shotDesignByShotId.shot_001?.composition
        ?.shotSize
    ).toBe('close-up');
    expect(
      secondContext.take.state.shotDesignByShotId.shot_001?.composition
        ?.shotSize
    ).toBe('wide-shot');

    const rereadFirst = await projectData.readSceneShotVideoTake({
      homeDir,
      takeId: firstTakeId,
    });
    expect(
      rereadFirst.state.shotDesignByShotId.shot_001?.composition?.shotSize
    ).toBe('close-up');
  });

  it('does not mutate the source Scene Shot List when take composition changes', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await projectData.updateSceneShotVideoTakeShotSpecs({
      homeDir,
      takeId: written.take.takeId,
      shotId: 'shot_001',
      shotSpecs: { shotSize: 'medium-close-up' },
    });

    const shotList = await projectData.readSceneShotList({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
    });
    expect(
      (shotList.shotList?.shots[0] as
        | SceneShotWithLegacyShotSpecs
        | undefined)?.shotSpecs
    ).toBeUndefined();
  });

  it('rejects duplicate and non-contiguous shot ids with structured core errors', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 4);
    const takeId = written.take.takeId;

    await expect(
      projectData.updateSceneShotVideoTakeShots({
        homeDir,
        takeId,
        shotIds: ['shot_001', 'shot_002', 'shot_002'],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA380' });

    await expect(
      projectData.updateSceneShotVideoTakeShots({
        homeDir,
        takeId,
        shotIds: ['shot_001', 'shot_003'],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA381' });
  });
});
