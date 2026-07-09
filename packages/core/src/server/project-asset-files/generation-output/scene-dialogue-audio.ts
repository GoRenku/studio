import { SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE } from '../../../client/index.js';
import type { GenerationOutputAllocation, GenerationOutputResolverInput } from './types.js';
import { temporaryOutputNames } from './types.js';

export async function resolveSceneDialogueAudioGenerationOutput(
  input: GenerationOutputResolverInput<typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE>
): Promise<GenerationOutputAllocation> {
  return {
    kind: 'temporary',
    destination: { kind: 'generation.media', purpose: input.specRecord.purpose },
    outputNames: temporaryOutputNames({
      purpose: input.specRecord.purpose,
      outputCount: input.outputCount,
      extension: '.mp3',
    }),
  };
}
