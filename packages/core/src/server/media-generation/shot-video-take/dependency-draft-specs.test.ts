import { describe, expect, it } from 'vitest';
import type {
  SceneShotVideoTakeGenerationTarget,
  ShotVideoTakeGenerationContext,
} from '../../../client/index.js';
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
        prompt: 'A precise first frame prompt.',
        title: 'Authored first frame',
      },
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

function testTarget(): SceneShotVideoTakeGenerationTarget {
  return {
    kind: 'sceneShotVideoTakeGeneration',
    id: 'take_generation_a',
    sceneId: 'scene_a',
    takeGenerationId: 'take_generation_a',
    shotIds: ['shot_001'],
  };
}

function testContext(
  target: SceneShotVideoTakeGenerationTarget,
  dependencyDraft?: NonNullable<
    ShotVideoTakeGenerationContext['takeGeneration']['production']['agentProposal']
  >['dependencyDrafts'][number]
): ShotVideoTakeGenerationContext {
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
    takeGeneration: {
      takeGenerationId: 'take_generation_a',
      sceneId: 'scene_a',
      shotListId: 'shot_list_a',
      shotIds: ['shot_001'],
      title: 'Take generation A',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      compatibility: {
        editState: 'editable',
        reasons: [],
        message: 'This take generation matches the current shot list.',
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
    shotGroupMode: 'single-shot',
    shots: [],
    displayShots: [],
    referencedCast: [],
    referencedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    availableInputs: [],
    existingTakes: [],
    defaults: {
      inputModeId: 'first-frame',
      imageDependencyModelChoice: 'fal-ai/openai/gpt-image-2',
      parameterValues: {},
    },
    resourceKeys: [],
  };
}
