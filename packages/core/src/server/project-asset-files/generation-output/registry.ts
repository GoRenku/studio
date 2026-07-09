import type {
  MediaGenerationPurpose,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  IMAGE_CREATE_GENERATION_PURPOSE,
  IMAGE_EDIT_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import { resolveCastGenerationOutput } from './cast.js';
import { resolveImageCreateGenerationOutput } from './image-create.js';
import { resolveImageEditGenerationOutput } from './image-edit.js';
import { resolveLocationGenerationOutput } from './location.js';
import { resolveLookbookGenerationOutput } from './lookbook.js';
import { resolveSceneDialogueAudioGenerationOutput } from './scene-dialogue-audio.js';
import { resolveSceneStoryboardGenerationOutput } from './scene-storyboard.js';
import { resolveShotVideoTakeGenerationOutput } from './shot-video-take.js';
import type {
  GenerationOutputAllocation,
  GenerationOutputResolver,
  GenerationOutputResolverInput,
  GenerationOutputResolverRegistry,
} from './types.js';

const generationOutputResolvers = {
  [CAST_CHARACTER_SHEET_GENERATION_PURPOSE]: resolveCastGenerationOutput,
  [CAST_PROFILE_GENERATION_PURPOSE]: resolveCastGenerationOutput,
  [CAST_VOICE_SAMPLE_GENERATION_PURPOSE]: resolveCastGenerationOutput,
  [LOOKBOOK_IMAGE_GENERATION_PURPOSE]: resolveLookbookGenerationOutput,
  [LOOKBOOK_SHEET_GENERATION_PURPOSE]: resolveLookbookGenerationOutput,
  [LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE]: resolveLocationGenerationOutput,
  [LOCATION_HERO_GENERATION_PURPOSE]: resolveLocationGenerationOutput,
  [SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE]: resolveSceneStoryboardGenerationOutput,
  [SHOT_VIDEO_TAKE_GENERATION_PURPOSE]: resolveShotVideoTakeGenerationOutput,
  [IMAGE_EDIT_GENERATION_PURPOSE]: resolveImageEditGenerationOutput,
  [IMAGE_CREATE_GENERATION_PURPOSE]: resolveImageCreateGenerationOutput,
  [SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE]: resolveSceneDialogueAudioGenerationOutput,
} satisfies GenerationOutputResolverRegistry;

export async function resolveGenerationOutputAllocation(input: {
  session: DatabaseSession;
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord;
  outputCount: number;
}): Promise<GenerationOutputAllocation> {
  return resolverFor(input.specRecord.purpose)(
    input as GenerationOutputResolverInput
  );
}

function resolverFor<P extends MediaGenerationPurpose>(
  purpose: P
): GenerationOutputResolver<P> {
  const resolver = generationOutputResolvers[purpose];
  if (!resolver) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_GENERATION_PURPOSE_UNSUPPORTED',
      `Media generation output placement is not defined for purpose: ${purpose}.`
    );
  }
  return resolver as GenerationOutputResolver<P>;
}
