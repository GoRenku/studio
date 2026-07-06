import {
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
} from '../../../../../client/index.js';
import type {
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeInputGenerationPurpose,
  MediaGenerationDependencyKind,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeModelChoice,
} from '../../../../../client/index.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';



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
      | 'video-prompt-sheet';
    outputInputKind:
      | 'first-frame'
      | 'last-frame'
      | 'reference-image'
      | 'video-prompt-sheet';
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
  [SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE]: {
    dependencyKind: 'video-prompt-sheet',
    outputInputKind: 'video-prompt-sheet',
    title: 'Shot video prompt sheet',
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
  if (dependencyKind === 'video-prompt-sheet') {
    return SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE;
  }
  throw new ProjectDataError(
    'CORE_MEDIA_DEPENDENCY_INVALID_DRAFT_SPEC',
    `Unsupported shot input dependency kind: ${dependencyKind}.`
  );
}



export type ShotInputRouteKind = 'text-to-image' | 'reference-to-image';

export function defaultShotInputParameterValues(
  modelChoice: ShotVideoTakeInputModelChoice,
  routeKind: ShotInputRouteKind
): NonNullable<SceneShotVideoTakeProductionState['parameterValues']> {
  if (modelChoice === 'fal-ai/openai/gpt-image-2') {
    return {
      image_size: { width: 1024, height: 768 },
      quality: 'low',
      output_format: 'png',
    };
  }
  if (modelChoice === 'fal-ai/nano-banana-2') {
    return {
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
      seed: null,
    };
  }
  if (routeKind === 'reference-to-image') {
    return {
      output_format: 'png',
    };
  }
  return {
    aspect_ratio: '16:9',
    resolution: '1k',
    output_format: 'png',
  };
}

export function supportedShotInputParameterNames(
  modelChoice: ShotVideoTakeInputModelChoice,
  routeKind: ShotInputRouteKind
): Set<string> {
  if (modelChoice === 'fal-ai/openai/gpt-image-2') {
    return new Set(['image_size', 'quality', 'output_format']);
  }
  if (modelChoice === 'fal-ai/nano-banana-2') {
    return new Set(['aspect_ratio', 'resolution', 'output_format', 'seed']);
  }
  if (routeKind === 'reference-to-image') {
    return new Set(['output_format']);
  }
  return new Set(['aspect_ratio', 'resolution', 'output_format']);
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
    value === SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
  );
}
