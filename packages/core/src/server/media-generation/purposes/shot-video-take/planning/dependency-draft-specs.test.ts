import { describe, expect, it } from 'vitest';
import type {
  SceneShotVideoTakeTarget,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import { buildShotInputDependencyDraftSpec } from './dependency-draft-specs.js';

describe('shot video take dependency draft specs', () => {
  it('returns missing-input for missing dependency prompts', async () => {
    const target = testTarget();

    await expect(
      buildShotInputDependencyDraftSpec({
        rootPurpose: 'shot.video-take',
        rootTarget: target,
        request: {
          kind: 'shot-video-take',
          context: testContext(target),
        },
        dependencyKind: 'first-frame',
        dependencyTarget: target,
        label: 'First frame',
        reason: 'Required by selected route.',
      })
    ).resolves.toMatchObject({
      materializationState: 'missing-input',
      materializationReason:
        'Author a concrete dependency draft before generating this shot input.',
    });
  });

  it('returns generatable for authored dependency prompts', async () => {
    const target = testTarget();

    await expect(
      buildShotInputDependencyDraftSpec({
        rootPurpose: 'shot.video-take',
        rootTarget: target,
        request: {
          kind: 'shot-video-take',
          context: testContext(target, {
            purpose: 'shot.first-frame',
            dependencyKind: 'first-frame',
            outputInputKind: 'first-frame',
            referenceMode: 'movie-lookbook',
            prompt: 'A precise first frame prompt.',
            title: 'Authored first frame',
          }),
        },
        dependencyKind: 'first-frame',
        dependencyTarget: target,
        label: 'First frame',
        reason: 'Required by selected route.',
      })
    ).resolves.toMatchObject({
      purpose: 'shot.first-frame',
      materializationState: 'generatable',
      spec: {
        referenceMode: 'movie-lookbook',
        prompt: 'A precise first frame prompt.',
        title: 'Authored first frame',
      },
    });
  });

  it('preserves prompt-sheet metadata for authored video prompt sheet drafts', async () => {
    const target = testTarget();

    await expect(
      buildShotInputDependencyDraftSpec({
        rootPurpose: 'shot.video-take',
        rootTarget: target,
        request: {
          kind: 'shot-video-take',
          context: testContext(target, {
            purpose: 'shot.video-prompt-sheet',
            dependencyKind: 'video-prompt-sheet',
            outputInputKind: 'video-prompt-sheet',
            referenceMode: 'storyboard-lookbook',
            promptSheetVisualStyleId: 'handdrawn-storyboard',
            promptSheetNotationModeId: 'motion-annotation',
            prompt: 'A precise video prompt sheet draft.',
            title: 'Authored video prompt sheet',
          }),
        },
        dependencyKind: 'video-prompt-sheet',
        dependencyTarget: target,
        label: 'Video prompt sheet',
        reason: 'Required by selected route.',
      })
    ).resolves.toMatchObject({
      purpose: 'shot.video-prompt-sheet',
      materializationState: 'generatable',
      spec: {
        promptSheetVisualStyleId: 'handdrawn-storyboard',
        promptSheetNotationModeId: 'motion-annotation',
        referenceMode: 'storyboard-lookbook',
        prompt: 'A precise video prompt sheet draft.',
        title: 'Authored video prompt sheet',
      },
    });
  });

  it('does not treat missing video prompt sheet drafts as runnable specs', async () => {
    const target = testTarget();

    const plan = await buildShotInputDependencyDraftSpec({
      rootPurpose: 'shot.video-take',
      rootTarget: target,
      request: {
        kind: 'shot-video-take',
        context: testContext(target),
      },
      dependencyKind: 'video-prompt-sheet',
      dependencyTarget: target,
      label: 'Video prompt sheet',
      reason: 'Required by selected route.',
    });

    expect(plan).toMatchObject({
      materializationState: 'missing-input',
    });
    expect(plan).not.toHaveProperty('spec');
  });

  it('omits prompt-sheet metadata from non-prompt-sheet dependency specs', async () => {
    const target = testTarget();

    await expect(
      buildShotInputDependencyDraftSpec({
        rootPurpose: 'shot.video-take',
        rootTarget: target,
        request: {
          kind: 'shot-video-take',
          context: testContext(target, {
            purpose: 'shot.first-frame',
            dependencyKind: 'first-frame',
            outputInputKind: 'first-frame',
            referenceMode: 'movie-lookbook',
            promptSheetVisualStyleId: 'cinematic-realistic',
            promptSheetNotationModeId: 'none',
            prompt: 'A first frame draft with stale prompt-sheet fields.',
            title: 'Authored first frame',
          }),
        },
        dependencyKind: 'first-frame',
        dependencyTarget: target,
        label: 'First frame',
        reason: 'Required by selected route.',
      })
    ).resolves.toMatchObject({
      purpose: 'shot.first-frame',
      materializationState: 'generatable',
      spec: expect.not.objectContaining({
        promptSheetVisualStyleId: expect.anything(),
        promptSheetNotationModeId: expect.anything(),
      }),
    });
  });

  it('rejects unsupported dependency targets with structured errors', async () => {
    const target = testTarget();

    await expect(
      buildShotInputDependencyDraftSpec({
        rootPurpose: 'shot.video-take',
        rootTarget: target,
        request: {
          kind: 'shot-video-take',
          context: testContext(target),
        },
        dependencyKind: 'first-frame',
        dependencyTarget: { kind: 'scene', id: 'scene_a' },
        label: 'First frame',
        reason: 'Required by selected route.',
      })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
    });
  });
});

function testTarget(): SceneShotVideoTakeTarget {
  return {
    kind: 'sceneShotVideoTake',
    id: 'take_a',
    sceneId: 'scene_a',
    takeId: 'take_a',
    shotIds: ['shot_001'],
  };
}

function testContext(
  target: SceneShotVideoTakeTarget,
  dependencyDraft?: NonNullable<
    ShotVideoTakeProductionContext['take']['state']['production']['agentProposal']
  >['dependencyDrafts'][number]
): ShotVideoTakeProductionContext {
  return {
    purpose: 'shot.video-take',
    target,
    project: {
      id: 'project_a',
      name: 'project-a',
      title: 'Project A',
      aspectRatio: '16:9',
    },
    scene: {
      id: 'scene_a',
      title: 'Scene A',
      setting: {},
      storyFunction: [],
    },
    shotList: {
      id: 'shot_list_a',
      title: 'Shot List A',
      summary: 'A test shot list.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isActive: true,
    },
    take: {
      takeId: 'take_a',
      sceneId: 'scene_a',
      sourceShotListId: 'shot_list_a',
      shotIds: ['shot_001'],
      title: 'Shot Video Take A',
      picked: false,
      video: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All tracked take references resolve.',
      },
      runnability: {
        state: 'not-evaluated',
        diagnostics: [],
        message: 'Run readiness is evaluated by shot-video preflight.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'This take matches its recorded history snapshot.' },
    },
      state: {
        version: 2,
        structure: {
          mode: 'continuous',
          sharedDirection: {
            referenceSelections: {
              dependencyInclusions: {},
              selectedCharacterSheetAssetIds: {},
              selectedLocationSheetAssetIds: {},
              selectedLookbookSheetIds: [],
              selectedDialogueAudioTakeIds: {},
            },
          },
        },
        production: {
          ...(dependencyDraft
            ? {
                agentProposal: {
                  basedOnInputModeId: 'first-frame',
                  basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
                  basedOnShotIds: ['shot_001'],
                  dependencyDrafts: [dependencyDraft],
                },
              }
            : {}),
        },
      },
    },
    shotGroupMode: 'single-shot',
    shots: [],
    displayShots: [],
    selectedCast: [],
    selectedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    mediaInputs: [],
    defaults: {
      inputModeId: 'first-frame',
      imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2',
      parameterValues: {},
    },
    resourceKeys: [],
  };
}
