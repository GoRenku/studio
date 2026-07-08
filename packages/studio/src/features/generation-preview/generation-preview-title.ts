import type { GenerationPreviewPurpose } from '@gorenku/studio-core/client';

const GENERATION_PREVIEW_TITLES = {
  'image.edit': 'Image Edit Generation Preview',
  'lookbook.image': 'Lookbook Image Generation Preview',
  'lookbook.sheet': 'Lookbook Sheet Generation Preview',
  'cast.character-sheet': 'Character Sheet Generation Preview',
  'cast.profile': 'Cast Profile Generation Preview',
  'location.environment-sheet': 'Location Environment Sheet Generation Preview',
  'location.hero': 'Location Hero Generation Preview',
  'scene.storyboard-sheet': 'Scene Storyboard Sheet Generation Preview',
  'shot.first-frame': 'Shot First Frame Generation Preview',
  'shot.last-frame': 'Shot Last Frame Generation Preview',
  'shot.reference-image': 'Shot Reference Image Generation Preview',
  'shot.video-prompt-sheet': 'Shot Prompt Sheet Generation Preview',
  'shot.video-take': 'Shot Video Generation Preview',
} satisfies Record<GenerationPreviewPurpose, string>;

export function generationPreviewTitle(
  purpose: GenerationPreviewPurpose
): string {
  return GENERATION_PREVIEW_TITLES[purpose];
}
