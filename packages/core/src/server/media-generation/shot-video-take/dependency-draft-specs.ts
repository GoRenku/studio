import {
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeProductionPlan,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  MediaGenerationDependencyDraftSpecInput,
  MediaGenerationDependencyDraftSpec,
} from '../dependency-draft-specs.js';
import {
  PURPOSE_CONFIG,
  defaultShotInputParameterValues,
  dependencyKindForPurpose,
  shotInputPurposeForDependencyKind,
} from './purpose-config.js';



export async function buildShotInputDependencyDraftSpec(
  input: MediaGenerationDependencyDraftSpecInput
): Promise<MediaGenerationDependencyDraftSpec> {
  if (input.dependencyTarget.kind !== 'sceneShotGroup') {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
      `Shot input dependency requires a sceneShotGroup target. Received: ${input.dependencyTarget.kind}.`
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
    request.context.productionGroup.videoTakeProduction.agentProposal?.dependencyDrafts.find(
      (candidate) =>
        candidate.purpose === purpose &&
        candidate.outputInputKind === outputInputKind
    );
  if (!isAuthoredShotDependencyDraft(draft)) {
    return {
      purpose,
      spec: {
        purpose,
        target: input.dependencyTarget,
        dependencyKind: dependencyKindForPurpose(purpose),
        outputInputKind,
        modelChoice: request.context.defaults.imageDependencyModelChoice,
        prompt: estimateOnlyShotInputPrompt(input.label),
        parameterValues: defaultShotInputParameterValues(),
        title: input.label,
      },
      materializationState: 'needs-authored-draft',
      materializationReason:
        'Author a concrete dependency draft before generating this shot input.',
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
      prompt: draft.prompt,
      parameterValues: draft.parameterValues ?? defaultShotInputParameterValues(),
      title: draft.title ?? input.label,
    },
    materializationState: 'generatable',
  };
}



export function estimateOnlyShotInputPrompt(label: string): string {
  return [
    `Estimate placeholder for ${label}.`,
    'This draft is used only for pricing; an authored prompt is required before generation.',
  ].join(' ');
}



export interface ShotVideoTakeDependencyRequest {
  kind: 'shot-video-take';
  context: ShotVideoTakeGenerationContext;
}



export function isAuthoredShotDependencyDraft(
  draft: NonNullable<ShotVideoTakeProductionPlan['agentProposal']>['dependencyDrafts'][number] | undefined
): draft is NonNullable<ShotVideoTakeProductionPlan['agentProposal']>['dependencyDrafts'][number] {
  if (!draft?.prompt.trim()) {
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
