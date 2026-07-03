import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';
import { createDeterministicIdGenerator } from '../../index.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('estimates a first-frame take when saved duration is numeric but provider expects a string enum', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
        },
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          basedOnShotIds: ['shot_001'],
          dependencyDrafts: [
            {
              purpose: 'shot.first-frame',
              dependencyKind: 'first-frame',
              outputInputKind: 'first-frame',
              referenceMode: 'movie-lookbook',
              prompt:
                'Author the first frame from the selected shot composition, cast, location, and Lookbook continuity.',
              title: 'Authored first frame',
            },
          ],
          finalPromptDraft: {
            prompt:
              'Generate the video take from the authored first frame with the saved duration setting.',
            title: 'Authored first-frame take',
          },
        },
      },
    });

    expect(estimate.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'first-frame',
          pricing: expect.objectContaining({
            state: 'priced',
            estimatedUsd: 0.005,
          }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'cast-character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'location-environment-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'lookbook-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(estimate.plan?.request.routeSettings.duration).toBe('9');
    expect(estimate.issues).toEqual([]);
  });

  it('rejects null input policies instead of treating them as omitted', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.readShotVideoTakeProductionPlan({
        homeDir,
        takeId: written.take.takeId,
        production: {
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
        },
        inputPolicy: null as never,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA434',
    });
  });

  it('drops stale settings that are unsupported by the selected route before estimating', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/kling-video/v3/pro',
        parameterValues: {
          duration: 5,
          aspect_ratio: '16:9',
        },
      },
    });

    expect(estimate.plan?.request.routeSettings).not.toHaveProperty('aspect_ratio');
    expect(estimate.plan?.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_PLAN_STALE_SETTING_DROPPED',
          severity: 'warning',
        }),
      ])
    );
    expect(estimate.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA385',
        }),
      ])
    );
  });

  it('includes planned dependency costs in the plan total', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const estimate = await projectData.estimateShotVideoTakeProduction({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 9,
        },
        agentProposal: {
          basedOnInputModeId: 'first-frame',
          basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
          dependencyDrafts: [
            {
              purpose: 'shot.first-frame',
              dependencyKind: 'first-frame',
              outputInputKind: 'first-frame',
              referenceMode: 'movie-lookbook',
              modelChoice: 'fal-ai/openai/gpt-image-2',
              prompt: 'First frame for the map-table shot.',
              parameterValues: {
                image_size: { width: 1024, height: 768 },
                quality: 'low',
              },
            },
          ],
        },
      },
    });

    const plan = estimate.plan;
    expect(plan).toBeTruthy();
    expect(plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          purpose: 'shot.first-frame',
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          purpose: 'shot.video-take',
        }),
      ])
    );
    expect(plan?.estimate.estimatedTotalUsd).toBeGreaterThan(
      estimate.estimate?.estimatedCostUsd ?? 0
    );
  });

  it('prices selected missing visual references for text-only shot video plans', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      takeId: written.take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect(report.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
          required: false,
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          id: `dependency:cast-character-sheet:${ids.castMemberId}`,
          required: false,
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
    expect(report.references.lookbook[0]?.card).toEqual(
      expect.objectContaining({
        state: 'selected-planned',
        dependencyLineId: `dependency:lookbook-sheet:${lookbook.lookbook.id}`,
        pricing: expect.objectContaining({ state: 'priced' }),
      })
    );
    expect(report.references.castMembers[0]?.characterSheets[0]?.card).toEqual(
      expect.objectContaining({
        state: 'selected-planned',
        dependencyLineId: `dependency:cast-character-sheet:${ids.castMemberId}`,
        pricing: expect.objectContaining({ state: 'priced' }),
      })
    );
  });

  it('keeps selected generated locations ready in the dependency inventory', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const scopedLocationId = await shotVideoTakeProject.addExtraLocationToSceneNarrative(ids);
    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const locationSheetFiles = await shotVideoTakeProject.writeLocationSheetImportFiles(
      project.projectFolder,
      'scoped-location-sheet'
    );
    const scopedLocationSheet =
      await projectData.importLocationEnvironmentSheetMedia({
        projectName: 'constantinople',
        homeDir,
        locationId: scopedLocationId,
        sourceProjectRelativePath: locationSheetFiles.primary,
        title: 'Scoped generated location sheet',
        description: 'Scoped Location Sheet used as an explicit shot reference.',
      });
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: {
        ...shotVideoTakeProject.sampleShotList(ids, 1),
        shots: [
          {
            ...shotVideoTakeProject.sampleShotList(ids, 1).shots[0]!,
            locationIds: [ids.locationId, scopedLocationId],
          },
        ],
      },
    });
    const takeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      idGenerator: createDeterministicIdGenerator(),
    });
    const take = takeReport.overview.take;
    await projectData.updateSceneShotVideoTakeLocationSheetSelection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      locationId: scopedLocationId,
      assetId: scopedLocationSheet.imported.assetId,
    });
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Imperial Wound',
      document: shotVideoTakeProject.lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.selectLookbookForType({
      projectName: 'constantinople',
      homeDir,
      type: 'movie',
      lookbookId: lookbook.lookbook.id,
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: take.takeId,
      production: {
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    const scopedLocation = report.references.locations.find(
      (location) => location.locationId === scopedLocationId
    );

    expect(scopedLocation?.environmentSheets[0]?.card).toEqual(
      expect.objectContaining({
        state: 'selected-ready',
        dependencyLineId: `dependency:location-environment-sheet:${scopedLocationId}:${scopedLocationSheet.imported.assetId}`,
        pricing: { state: 'priced', estimatedUsd: 0 },
      })
    );
    expect(report.plan.dependencyInventory.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:location-environment-sheet:${scopedLocationId}:${scopedLocationSheet.imported.assetId}`,
          availability: { state: 'satisfied' },
          selectedAsset: expect.objectContaining({
            assetId: scopedLocationSheet.imported.assetId,
          }),
          pricing: { state: 'priced', estimatedUsd: 0 },
        }),
      ])
    );
    expect(report.plan.dependencyInventory.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `dependency:location-environment-sheet:${ids.locationId}`,
        }),
        expect.objectContaining({
          id: `dependency:location-environment-sheet:${scopedLocationId}`,
        }),
      ])
    );
  });

  it('excludes optional reference-image dependencies from shot video plans', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      takeId: written.take.takeId,
      direction: {},
    });
    const production = {
      inputModeId: 'text-only' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
      requestedInputs: [
        {
          kind: 'reference-image' as const,
          subjectKind: 'shot' as const,
          subjectId: 'shot_001',
        },
      ],
    };
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      production,
    });
    await projectData.updateSceneShotVideoTakeReferenceInclusion({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      dependencyId: 'reference-image:shot:shot_001',
      inclusion: 'exclude',
    });

    const report = await projectData.readShotVideoTakeProductionPlan({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      production,
    });

    expect(report.plan.dependencyInventory.dependencies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dependency:reference-image:shot:shot_001',
        }),
      ])
    );
    expect(report.references.general).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reference-image',
          selected: false,
          card: expect.objectContaining({
            dependencyId: 'reference-image:shot:shot_001',
            included: false,
            inclusionOverride: 'exclude',
          }),
        }),
      ])
    );
  });
});
