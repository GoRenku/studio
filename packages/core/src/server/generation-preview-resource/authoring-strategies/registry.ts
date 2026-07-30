import type {
  GenerationOutputMediaKind,
} from '../../../client/generation.js';
import type { GenerationPreviewAuthoringStrategy } from './types.js';
import { imageAuthoringStrategy } from './image.js';
import { noneAuthoringStrategy } from './none.js';
import { videoAuthoringStrategy } from './video.js';

const strategies: Record<
  GenerationOutputMediaKind | 'none',
  GenerationPreviewAuthoringStrategy
> = {
  image: imageAuthoringStrategy,
  video: videoAuthoringStrategy,
  audio: noneAuthoringStrategy,
  none: noneAuthoringStrategy,
};

export function readGenerationPreviewAuthoringStrategy(
  mediaKind: GenerationOutputMediaKind | null,
): GenerationPreviewAuthoringStrategy {
  return strategies[mediaKind ?? 'none'];
}
