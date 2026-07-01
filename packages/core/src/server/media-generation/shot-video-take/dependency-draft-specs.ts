import {
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  DraftMediaGenerationSpec,
  MediaGenerationDependencyPricing,
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

async function estimateMissingShotInputDependency(input: {
  projectName?: string;
  homeDir?: string;
  draftGenerationSpec: DraftMediaGenerationSpec;
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  estimate: import('@gorenku/studio-engines').GenerationEstimate | null;
}> {
  try {
    const { estimateDraftMediaGenerationSpec } = await import(
      '../shared-generation-service.js'
    );
    const estimateReport = await estimateDraftMediaGenerationSpec({
      projectName: input.projectName,
      homeDir: input.homeDir,
      spec: input.draftGenerationSpec.spec,
    });
    const estimate = estimateReport.estimate;
    if (estimate.estimatedCostUsd === null) {
      return {
        pricing: {
          state: 'unpriced',
          estimatedUsd: null,
          reason:
            estimate.warnings.join(' ') ||
            'No pricing is configured for this dependency route.',
          overrideRequired: true,
        },
        estimate,
      };
    }
    return {
      pricing: { state: 'priced', estimatedUsd: estimate.estimatedCostUsd },
      estimate,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Dependency estimate failed.';
    return {
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: message,
        overrideRequired: true,
      },
      estimate: null,
    };
  }
}



export function estimateOnlyShotInputPrompt(label: string): string {
  return [
    `Estimate placeholder for ${label}.`,
    'This draft is used only for pricing; an authored prompt is required before generation.',
  ].join(' ');
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
