import {
  IMAGE_CREATE_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  DraftMediaGenerationSpec,
  ImageCreateGenerationSpec,
  ImageCreateReferenceImage,
  ShotVideoTakeProductionContext,
  SceneShotVideoTakeProductionState,
} from '../../../../../client/index.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  MediaGenerationDependencyDraftSpecInput,
  MediaGenerationDependencyDraftPlan,
} from '../../../dependencies/dependency-draft-specs.js';
import {
  defaultShotInputParameterValues,
} from '../shared/purpose-config.js';
import {
  estimateMissingShotInputDependency,
  estimateOnlyShotInputPrompt,
} from '../../../cost/shot-input-dependency-estimates.js';
import {
  resolveShotVideoInputReferenceBundle,
  type ShotVideoInputReferenceBundle,
} from './shot-input-references.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';



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
  const outputInputKind = shotInputKindForDependencyKind(input.dependencyKind);
  const draft =
    request.context.take.state.production.agentProposal?.dependencyDrafts.find(
      (candidate) => candidate.outputInputKind === outputInputKind
    );
  if (!isAuthoredShotDependencyDraft(draft)) {
    const modelChoice = request.context.defaults.imageDependencyModelChoice;
    const pricingImageCreateSpec = imageCreateSpec({
      context: request.context,
      mode: 'text-to-image',
      modelChoice,
      prompt: estimateOnlyShotInputPrompt(input.label),
      referenceImages: [],
      parameterValues: defaultShotInputParameterValues(
        modelChoice,
        'reference-to-image'
      ),
      title: input.label,
    });
    const pricingSpec = {
      purpose: IMAGE_CREATE_GENERATION_PURPOSE,
      spec: pricingImageCreateSpec,
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
  const modelChoice =
    draft.modelChoice ?? request.context.defaults.imageDependencyModelChoice;
  const references = await resolveShotInputReferenceImages({
    projectName: input.projectName,
    homeDir: input.homeDir,
    context: request.context,
    inputKind: outputInputKind,
    referenceMode: draft.referenceMode,
  });
  return {
    purpose: IMAGE_CREATE_GENERATION_PURPOSE,
    spec: imageCreateSpec({
      context: request.context,
      mode: 'reference-to-image',
      modelChoice,
      prompt: draft.prompt,
      referenceImages: references,
      parameterValues:
        draft.parameterValues ??
        defaultShotInputParameterValues(modelChoice, 'reference-to-image'),
      title: draft.title ?? input.label,
    }),
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
    draft.outputInputKind === 'reference-image' &&
    !draft.title?.trim()
  ) {
    return false;
  }
  return true;
}

function shotInputKindForDependencyKind(
  dependencyKind: MediaGenerationDependencyDraftSpecInput['dependencyKind']
): 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet' {
  if (
    dependencyKind === 'first-frame' ||
    dependencyKind === 'last-frame' ||
    dependencyKind === 'reference-image' ||
    dependencyKind === 'video-prompt-sheet'
  ) {
    return dependencyKind;
  }
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
    `Unsupported shot input dependency kind: ${dependencyKind}.`
  );
}

function imageCreateSpec(input: {
  context: ShotVideoTakeProductionContext;
  mode: ImageCreateGenerationSpec['mode'];
  modelChoice: ImageCreateGenerationSpec['modelChoice'];
  prompt: string;
  referenceImages: ImageCreateReferenceImage[];
  parameterValues: ImageCreateGenerationSpec['parameterValues'];
  title: string;
}): ImageCreateGenerationSpec {
  const projectId = input.context.project.id;
  if (!projectId) {
    throw new ProjectDataError(
      'CORE_IMAGE_CREATE_PROJECT_TARGET_MISSING',
      'Shot input image dependency drafts require a resolved project id.'
    );
  }
  return {
    purpose: IMAGE_CREATE_GENERATION_PURPOSE,
    target: { kind: 'project', id: projectId },
    mode: input.mode,
    modelChoice: input.modelChoice,
    prompt: input.prompt,
    referenceImages: input.referenceImages,
    parameterValues: input.parameterValues,
    title: input.title,
  };
}

async function resolveShotInputReferenceImages(input: {
  projectName?: string;
  homeDir?: string;
  context: ShotVideoTakeProductionContext;
  inputKind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet';
  referenceMode: NonNullable<
    NonNullable<SceneShotVideoTakeProductionState['agentProposal']>['dependencyDrafts'][number]['referenceMode']
  >;
}): Promise<ImageCreateReferenceImage[]> {
  return withShotProjectSession(input, ({ session }) => {
    const bundle = resolveShotVideoInputReferenceBundle({
      session,
      context: input.context,
      inputKind: input.inputKind,
      referenceMode: input.referenceMode,
    });
    return referenceImagesFromBundle(bundle);
  });
}

function referenceImagesFromBundle(
  bundle: ShotVideoInputReferenceBundle
): ImageCreateReferenceImage[] {
  return [
    ...(bundle.styleReference ? [bundle.styleReference] : []),
    ...bundle.continuityReferences,
  ].map((reference) => ({
    assetId: reference.assetId,
    assetFileId: reference.assetFileId,
    role: reference.role,
  }));
}
