import type { MediaPurpose } from './media-attachments.js';

/**
 * A generation lane is one group of generation defaults in Project Settings.
 * The lane boundary is generating new media versus editing existing media;
 * operation variants such as image-to-video do not get their own lanes.
 */
export type GenerationLane = 'image' | 'imageEdit' | 'video' | 'audio';

export const GENERATION_LANES = [
  'image',
  'imageEdit',
  'video',
  'audio',
] as const satisfies readonly GenerationLane[];

export const GENERATION_LANE_LABELS: Record<GenerationLane, string> = {
  image: 'Image Generation',
  imageEdit: 'Image Editing',
  video: 'Video Generation',
  audio: 'Audio Generation',
};

/**
 * The built-in provider of the agent host, usable without an API key. It is
 * the one provider id Studio names directly (ADR 0103).
 */
export const HOST_GENERATION_PROVIDER = {
  provider: 'codex',
  label: 'Codex (built-in)',
} as const;

/** Kebab-case lane names used by CLI flags. */
export const GENERATION_LANE_SLUGS: Record<GenerationLane, string> = {
  image: 'image',
  imageEdit: 'image-edit',
  video: 'video',
  audio: 'audio',
};

/**
 * `video.edit` stays in the video lane until a Video Editing lane exists.
 */
export const MEDIA_PURPOSE_GENERATION_LANES: Record<MediaPurpose, GenerationLane> = {
  'image.create': 'image',
  'image.edit': 'imageEdit',
  'video.edit': 'video',
  'project.cover': 'image',
  'shot-plan.video-generation': 'video',
  'shot-plan.video-first-frame': 'image',
  'shot-plan.video-last-frame': 'image',
  'shot-plan.video-storyboard': 'image',
  'shot-plan.video-reference': 'image',
  'lookbook.image': 'image',
  'lookbook.video-sheet': 'image',
  'lookbook.storyboard-sheet': 'image',
  'cast.character-sheet': 'image',
  'cast.profile': 'image',
  'cast.voice-sample': 'audio',
  'shot-plan.dialogue-audio': 'audio',
  'location.sheet': 'image',
  'location.hero': 'image',
  'prop.sheet': 'image',
  'prop.hero': 'image',
  'scene.storyboard-sheet': 'image',
  'shot.image': 'image',
};

export function isGenerationLane(value: string): value is GenerationLane {
  return (GENERATION_LANES as readonly string[]).includes(value);
}
