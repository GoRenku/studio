import type { GenerationPreviewPurpose } from '@gorenku/studio-core/client';

export function generationPreviewTitle(
  purpose: GenerationPreviewPurpose
): string {
  switch (purpose) {
    case 'cast.character-sheet':
      return 'Character Sheet Generation Preview';
    case 'shot.video-prompt-sheet':
      return 'Shot Prompt Sheet Generation Preview';
    case 'shot.video-take':
      return 'Shot Video Generation Preview';
  }
}
