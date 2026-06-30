export const LOOKBOOK_IMAGE_GENERATION_PURPOSE = 'lookbook.image' as const;

export const LOOKBOOK_SHEET_GENERATION_PURPOSE = 'lookbook.sheet' as const;

export const CAST_CHARACTER_SHEET_GENERATION_PURPOSE =
  'cast.character-sheet' as const;

export const CAST_PROFILE_GENERATION_PURPOSE = 'cast.profile' as const;

export const CAST_VOICE_SAMPLE_GENERATION_PURPOSE =
  'cast.voice-sample' as const;

export const LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE =
  'location.environment-sheet' as const;

export const LOCATION_HERO_GENERATION_PURPOSE = 'location.hero' as const;

export const SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE =
  'scene.storyboard-sheet' as const;

export const SHOT_FIRST_FRAME_GENERATION_PURPOSE =
  'shot.first-frame' as const;

export const SHOT_LAST_FRAME_GENERATION_PURPOSE =
  'shot.last-frame' as const;

export const SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE =
  'shot.reference-image' as const;

export const SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE =
  'shot.video-prompt-sheet' as const;

export const SHOT_VIDEO_TAKE_GENERATION_PURPOSE =
  'shot.video-take' as const;

export const SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE =
  'scene.dialogue-audio' as const;

export type MediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof LOOKBOOK_SHEET_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE
  | typeof LOCATION_HERO_GENERATION_PURPOSE
  | typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE
  | typeof SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
  | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE
  | typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE;
