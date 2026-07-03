import {
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  DraftMediaGenerationSpec,
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeProductionState,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  MediaGenerationDependencyDraftSpecInput,
  MediaGenerationDependencyDraftPlan,
} from '../dependency-draft-specs.js';
import {
  PURPOSE_CONFIG,
  defaultShotInputParameterValues,
  dependencyKindForPurpose,
  shotInputPurposeForDependencyKind,
} from './purpose-config.js';
import {
  estimateMissingShotInputDependency,
  estimateOnlyShotInputPrompt,
} from '../estimation/shot-input-dependency-estimates.js';



export async function buildShotInputDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftPlan> {
  if (input.dependencyTarget.kind !== 'sceneShotVideoTake') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Shot input dependency requires a sceneShotVideoTake target. Received: ${input.dependencyTarget.kind}.`
    );
  }
  if (input.request.kind !== 'shot-video-take') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Shot input dependency requires a shot-video-take request. Received: ${input.request.kind}.`
    );
  }
  const request = input.request as unknown as ShotVideoTakeDependencyRequest;
  const purpose = shotInputPurposeForDependencyKind(input.dependencyKind);
  const outputInputKind = PURPOSE_CONFIG[purpose].outputInputKind;
  const draft =
    request.context.take.state.production.agentProposal?.dependencyDrafts.find(
      (candidate) =>
        candidate.purpose === purpose &&
        candidate.outputInputKind === outputInputKind
    );
  if (!isAuthoredShotDependencyDraft(draft)) {
    const pricingSpec = {
      purpose,
      spec: {
        purpose,
        target: input.dependencyTarget,
        dependencyKind: dependencyKindForPurpose(purpose),
        outputInputKind,
        modelChoice: request.context.defaults.imageDependencyModelChoice,
        referenceMode: 'movie-lookbook',
        prompt: estimateOnlyShotInputPrompt(input.label),
        parameterValues: defaultShotInputParameterValues(),
        title: input.label,
      },
    } satisfies DraftMediaGenerationSpec;
    const priced = await estimateMissingShotInputDependency({
      projectName: input.projectName,
      homeDir: input.homeDir,
      draftGenerationSpec: pricingSpec,
    });
    return {
      materializationState: 'missing-input',
      materializationReason:
        'Author a concrete dependency draft before generating this shot input.',
      pricing: priced.pricing,
      estimate: priced.estimate,
    };
  }
  return {
    purpose,
    spec: {
      purpose,
      target: input.dependencyTarget,
      dependencyKind: dependencyKindForPurpose(purpose),
      outputInputKind,
      modelChoice:
        draft.modelChoice ?? request.context.defaults.imageDependencyModelChoice,
      referenceMode: draft.referenceMode,
      prompt: draft.prompt,
      parameterValues: draft.parameterValues ?? defaultShotInputParameterValues(),
      title: draft.title ?? input.label,
    },
    materializationState: 'generatable',
  };
}

export interface ShotVideoTakeDependencyRequest {
  kind: 'shot-video-take';
  context: ShotVideoTakeProductionContext;
}



export function isAuthoredShotDependencyDraft(
  draft: NonNullable<SceneShotVideoTakeProductionState['agentProposal']>['dependencyDrafts'][number] | undefined
): draft is NonNullable<SceneShotVideoTakeProductionState['agentProposal']>['dependencyDrafts'][number] {
  if (!draft?.prompt.trim()) {
    return false;
  }
  if (
    draft.referenceMode !== 'movie-lookbook' &&
    draft.referenceMode !== 'storyboard-lookbook'
  ) {
    return false;
  }
  if (
    draft.purpose === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE &&
    !draft.title?.trim()
  ) {
    return false;
  }
  return true;
}
