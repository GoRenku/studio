import type {
  SceneShotVideoTakeProductionState,
  ShotVideoTakeInputModelChoice,
  ShotVideoTakeModelChoice,
} from '../../../../../client/index.js';

export const INPUT_MODEL_CHOICES = new Set<ShotVideoTakeInputModelChoice>([
  'fal-ai/openai/gpt-image-2',
  'fal-ai/nano-banana-2',
  'fal-ai/xai/grok-imagine-image',
]);

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

export function providerModel(
  modelChoice: ShotVideoTakeInputModelChoice | ShotVideoTakeModelChoice
): string {
  if (modelChoice.startsWith('fal-ai/')) {
    return modelChoice.slice('fal-ai/'.length);
  }
  return modelChoice;
}
