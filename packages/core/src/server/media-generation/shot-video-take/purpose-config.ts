import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeInputGenerationPurpose,
  MediaGenerationDependencyKind,
  ShotVideoTakeProductionPlan,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeModelChoice,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';



export const INPUT_MODEL_CHOICES = new Set<ShotVideoTakeInputModelChoice>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);



export const PURPOSE_CONFIG: Record<
  ShotVideoTakeInputGenerationPurpose,
  {
    dependencyKind:
      | 'first-frame'
      | 'last-frame'
      | 'reference-image'
      | 'multi-shot-storyboard-sheet';
    outputInputKind:
      | 'first-frame'
      | 'last-frame'
      | 'reference-image'
      | 'multi-shot-storyboard-sheet';
    title: string;
  }
> = {
  [SHOT_FIRST_FRAME_GENERATION_PURPOSE]: {
    dependencyKind: 'first-frame',
    outputInputKind: 'first-frame',
    title: 'Shot first frame',
  },
  [SHOT_LAST_FRAME_GENERATION_PURPOSE]: {
    dependencyKind: 'last-frame',
    outputInputKind: 'last-frame',
    title: 'Shot last frame',
  },
  [SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE]: {
    dependencyKind: 'reference-image',
    outputInputKind: 'reference-image',
    title: 'Shot reference image',
  },
  [SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE]: {
    dependencyKind: 'multi-shot-storyboard-sheet',
    outputInputKind: 'multi-shot-storyboard-sheet',
    title: 'Shot multi-shot storyboard sheet',
  },
};



export function shotInputPurposeForDependencyKind(
  dependencyKind: MediaGenerationDependencyKind
): ShotVideoTakeInputGenerationPurpose {
  if (dependencyKind === 'first-frame') {
    return SHOT_FIRST_FRAME_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'last-frame') {
    return SHOT_LAST_FRAME_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'reference-image') {
    return SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE;
  }
  if (dependencyKind === 'multi-shot-storyboard-sheet') {
    return SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE;
  }
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
    `Unsupported shot input dependency kind: ${dependencyKind}.`
  );
}



export function defaultShotInputParameterValues(): NonNullable<ShotVideoTakeProductionPlan['parameterValues']> {
  return {
    image_size: { width: 1024, height: 768 },
    quality: 'low',
  };
}



export function dependencyKindForPurpose(
  purpose: ShotVideoTakeInputGenerationPurpose
): ShotVideoTakeInputGenerationSpec['dependencyKind'] {
  return PURPOSE_CONFIG[purpose].dependencyKind;
}



export function providerModel(
  modelChoice: ShotVideoTakeInputModelChoice | ShotVideoTakeModelChoice
): string {
  if (modelChoice.startsWith('fal-ai/')) {
    return modelChoice.slice('fal-ai/'.length);
  }
  return modelChoice;
}



export function titleForInputSpec(spec: ShotVideoTakeInputGenerationSpec): string {
  return spec.title?.trim() || spec.prompt.slice(0, 80) || PURPOSE_CONFIG[spec.purpose].title;
}



export function isShotInputPurpose(value: unknown): value is ShotVideoTakeInputGenerationPurpose {
  return (
    value === SHOT_FIRST_FRAME_GENERATION_PURPOSE ||
    value === SHOT_LAST_FRAME_GENERATION_PURPOSE ||
    value === SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE ||
    value === SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE
  );
}
