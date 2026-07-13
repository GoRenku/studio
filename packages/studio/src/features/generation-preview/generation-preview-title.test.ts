import { describe, expect, it } from 'vitest';
import type { GenerationPreviewPurpose } from '@gorenku/studio-core/client';
import { generationPreviewTitle } from './generation-preview-title';

const PREVIEW_TITLE_CASES = {
  'image.edit': 'Image Edit Generation Preview',
  'lookbook.image': 'Lookbook Image Generation Preview',
  'lookbook.video-sheet': 'Lookbook Sheet Generation Preview',
  'lookbook.storyboard-sheet': 'Lookbook Sheet Generation Preview',
  'cast.video-character-sheet': 'Character Sheet Generation Preview',
  'cast.storyboard-character-sheet': 'Character Sheet Generation Preview',
  'cast.profile': 'Cast Profile Generation Preview',
  'location.sheet': 'Location Environment Sheet Generation Preview',
  'location.hero': 'Location Hero Generation Preview',
  'scene.storyboard-sheet': 'Scene Storyboard Sheet Generation Preview',
  'image.create': 'Image Create Generation Preview',
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
