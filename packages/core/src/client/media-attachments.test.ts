import { describe, expect, it } from 'vitest';
import {
  MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS,
  MEDIA_PURPOSE_TARGET_KINDS,
} from './media-attachments.js';

const mediaPurposes = [
  'image.create',
  'image.edit',
  'video.edit',
  'project.cover',
  'shot-plan.video-generation',
  'shot-plan.video-first-frame',
  'shot-plan.video-last-frame',
  'shot-plan.video-storyboard',
  'shot-plan.video-reference',
  'lookbook.image',
  'lookbook.video-sheet',
  'lookbook.storyboard-sheet',
  'cast.character-sheet',
  'cast.profile',
  'cast.voice-sample',
  'scene.dialogue-audio',
  'location.sheet',
  'location.hero',
  'prop.sheet',
  'prop.hero',
  'scene.storyboard-sheet',
  'shot.image',
] as const;

describe('media purpose identity maps', () => {
  it('defines one target and output media kind for every public purpose', () => {
    expect(Object.keys(MEDIA_PURPOSE_TARGET_KINDS)).toEqual(mediaPurposes);
    expect(Object.keys(MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS)).toEqual(mediaPurposes);
    expect(MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS['cast.voice-sample']).toBe('audio');
    expect(MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS['scene.dialogue-audio']).toBe('audio');
    expect(MEDIA_PURPOSE_OUTPUT_MEDIA_KINDS['shot-plan.video-generation']).toBe('video');
  });
});
