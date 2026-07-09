import { SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE } from '../../../client/index.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { specObject, targetId, temporaryOutputNames } from './types.js';

export async function resolveSceneStoryboardGenerationOutput(
  input: GenerationOutputResolverInput<typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE>
): Promise<GenerationOutputAllocation> {
  return {
    kind: 'temporary',
    destination: {
      kind: 'scene.storyboardSourceSheet',
      sceneId: targetId(specObject(input.specRecord)),
    },
    outputNames: temporaryOutputNames({
      purpose: input.specRecord.purpose,
      outputCount: input.outputCount,
      extension: '.png',
    }),
  };
}
