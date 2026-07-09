import { SHOT_VIDEO_TAKE_GENERATION_PURPOSE } from '../../../client/index.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { sourceProjectRelativePathForMediaKind, specObject, targetId } from './types.js';

export async function resolveShotVideoTakeGenerationOutput(
  input: GenerationOutputResolverInput<typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE>
): Promise<GenerationOutputAllocation> {
  return {
    kind: 'durableAsset',
    destination: {
      kind: 'shotVideoTake.media',
      takeId: targetId(specObject(input.specRecord)),
      role: 'video',
    },
    sourceProjectRelativePath: sourceProjectRelativePathForMediaKind('video'),
    mediaKind: 'video',
  };
}
