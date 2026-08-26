export type MediaPurpose =
  | 'image.create'
  | 'image.edit'
  | 'project.cover'
  | 'shot-plan.video-generation'
  | 'shot-plan.video-first-frame'
  | 'shot-plan.video-last-frame'
  | 'shot-plan.video-storyboard'
  | 'shot-plan.video-reference'
  | 'lookbook.image'
  | 'lookbook.video-sheet'
  | 'lookbook.storyboard-sheet'
  | 'cast.character-sheet'
  | 'cast.profile'
  | 'cast.voice-sample'
  | 'scene.dialogue-audio'
  | 'location.sheet'
  | 'location.hero'
  | 'prop.sheet'
  | 'prop.hero'
  | 'scene.storyboard-sheet'
  | 'shot.image';

export type MediaTarget =
  | { kind: 'project'; id: string }
  | { kind: 'asset'; id: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'prop'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'shot'; id: string }
  | { kind: 'shotPlan'; id: string }
  | { kind: 'sceneDialogue'; sceneId: string; turnId: string };

export const MEDIA_PURPOSE_TARGET_KINDS = {
  'image.create': 'shotPlan',
  'image.edit': 'asset',
  'project.cover': 'project',
  'shot-plan.video-generation': 'shotPlan',
  'shot-plan.video-first-frame': 'shotPlan',
  'shot-plan.video-last-frame': 'shotPlan',
  'shot-plan.video-storyboard': 'shotPlan',
  'shot-plan.video-reference': 'shotPlan',
  'lookbook.image': 'lookbook',
  'lookbook.video-sheet': 'lookbook',
  'lookbook.storyboard-sheet': 'lookbook',
  'cast.character-sheet': 'castMember',
  'cast.profile': 'castMember',
  'cast.voice-sample': 'castMember',
  'scene.dialogue-audio': 'sceneDialogue',
  'location.sheet': 'location',
  'location.hero': 'location',
  'prop.sheet': 'prop',
  'prop.hero': 'prop',
  'scene.storyboard-sheet': 'scene',
  'shot.image': 'shot',
} as const satisfies Record<MediaPurpose, MediaTarget['kind']>;

export const MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS: Record<
  MediaPurpose,
  'image' | 'video' | 'audio'
> = {
  'image.create': 'image',
  'image.edit': 'image',
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
  'scene.dialogue-audio': 'audio',
  'location.sheet': 'image',
  'location.hero': 'image',
  'prop.sheet': 'image',
  'prop.hero': 'image',
  'scene.storyboard-sheet': 'image',
  'shot.image': 'image',
};

export function isMediaPurpose(value: string): value is MediaPurpose {
  return value in MEDIA_PURPOSE_TARGET_KINDS;
}
