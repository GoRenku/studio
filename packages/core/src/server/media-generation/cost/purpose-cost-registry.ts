import type {
  MediaGenerationCostProjection,
  MediaGenerationPurpose,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  buildMediaGenerationCostProjection,
  type MediaGenerationCostProjectionInput,
} from './cost-projection.js';

export interface MediaGenerationPurposeCostDefinition {
  purpose: MediaGenerationPurpose;
  buildCostProjection(
    input: MediaGenerationCostProjectionInput
  ): Promise<MediaGenerationCostProjection>;
}

const COST_DEFINITIONS = [
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
].map((purpose) => ({
  purpose,
  buildCostProjection: buildMediaGenerationCostProjection,
})) satisfies MediaGenerationPurposeCostDefinition[];

const COST_DEFINITIONS_BY_PURPOSE = new Map<
  MediaGenerationPurpose,
  MediaGenerationPurposeCostDefinition
>(COST_DEFINITIONS.map((definition) => [definition.purpose, definition]));

export function listMediaGenerationPurposeCostDefinitions(): MediaGenerationPurposeCostDefinition[] {
  return COST_DEFINITIONS;
}

export function requireMediaGenerationPurposeCostDefinition(
  purpose: MediaGenerationPurpose
): MediaGenerationPurposeCostDefinition {
  const definition = COST_DEFINITIONS_BY_PURPOSE.get(purpose);
  if (!definition) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_PROJECTION_MISSING',
      `Media generation purpose has no cost projection: ${purpose}.`
    );
  }
  return definition;
}
