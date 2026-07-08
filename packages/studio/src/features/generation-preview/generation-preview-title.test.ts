import { describe, expect, it } from 'vitest';
import type { GenerationPreviewPurpose } from '@gorenku/studio-core/client';
import { generationPreviewTitle } from './generation-preview-title';

const PREVIEW_TITLE_CASES = {
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

describe('generationPreviewTitle', () => {
  it.each(Object.entries(PREVIEW_TITLE_CASES))(
    'returns a dialog title for %s',
    (purpose, title) => {
      expect(generationPreviewTitle(purpose as GenerationPreviewPurpose)).toBe(title);
    }
  );
});
