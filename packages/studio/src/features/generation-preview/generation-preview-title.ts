import type { GenerationPreviewPurpose } from '@gorenku/studio-core/client';

const GENERATION_PREVIEW_TITLES = {
  'image.edit': 'Image Edit Generation Preview',
  'lookbook.image': 'Lookbook Image Generation Preview',
  'lookbook.video-sheet': 'Lookbook Sheet Generation Preview',
  'lookbook.storyboard-sheet': 'Lookbook Sheet Generation Preview',
  'cast.character-sheet': 'Character Sheet Generation Preview',
  'cast.profile': 'Cast Profile Generation Preview',
  'location.sheet': 'Location Sheet Generation Preview',
  'location.hero': 'Location Hero Generation Preview',
  'scene.storyboard-sheet': 'Scene Storyboard Sheet Generation Preview',
  'shot.image': 'Shot Image Generation Preview',
  'image.create': 'Image Create Generation Preview',
  'shot-plan.video-generation': 'Shot Plan Video Generation Preview',
  'shot-plan.video-first-frame': 'First Frame Generation Preview',
  'shot-plan.video-last-frame': 'Last Frame Generation Preview',
  'shot-plan.video-storyboard': 'Video Storyboard Generation Preview',
} satisfies Record<GenerationPreviewPurpose, string>;

export function generationPreviewTitle(
  purpose: GenerationPreviewPurpose
): string {
  return GENERATION_PREVIEW_TITLES[purpose];
}
