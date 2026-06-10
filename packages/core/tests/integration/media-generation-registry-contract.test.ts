import { describe, expect, it } from 'vitest';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type MediaGenerationPurpose,
} from '../../src/client/index.js';
import {
  listMediaGenerationPurposeDefinitions,
  requireMediaGenerationPurposeDefinition,
} from '../../src/server/media-generation/purpose-registry.js';

const REGISTERED_PURPOSES: MediaGenerationPurpose[] = [
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
];

describe('media generation purpose registry contract', () => {
  it('registers every current media generation purpose exactly once', () => {
    const definitions = listMediaGenerationPurposeDefinitions();
    const purposes = definitions.map((definition) => definition.purpose);

    expect([...purposes].sort()).toEqual([...REGISTERED_PURPOSES].sort());
    expect(new Set(purposes).size).toBe(purposes.length);
  });

  it('exposes the expected media and target kind for each purpose', () => {
    expect(
      listMediaGenerationPurposeDefinitions().map((definition) => ({
        purpose: definition.purpose,
        mediaKind: definition.mediaKind,
        targetKind: definition.targetKind,
      }))
    ).toEqual([
      { purpose: 'lookbook.image', mediaKind: 'image', targetKind: 'lookbook' },
      { purpose: 'lookbook.sheet', mediaKind: 'image', targetKind: 'lookbook' },
      { purpose: 'cast.character-sheet', mediaKind: 'image', targetKind: 'castMember' },
      { purpose: 'cast.profile', mediaKind: 'image', targetKind: 'castMember' },
      { purpose: 'cast.voice-sample', mediaKind: 'audio', targetKind: 'castMember' },
      { purpose: 'location.environment-sheet', mediaKind: 'image', targetKind: 'location' },
      { purpose: 'scene.storyboard-sheet', mediaKind: 'image', targetKind: 'scene' },
      { purpose: 'scene.dialogue-audio', mediaKind: 'audio', targetKind: 'sceneDialogue' },
      { purpose: 'shot.first-frame', mediaKind: 'image', targetKind: 'sceneShotGroup' },
      { purpose: 'shot.last-frame', mediaKind: 'image', targetKind: 'sceneShotGroup' },
      { purpose: 'shot.reference-image', mediaKind: 'image', targetKind: 'sceneShotGroup' },
      {
        purpose: 'shot.multi-shot-storyboard-sheet',
        mediaKind: 'image',
        targetKind: 'sceneShotGroup',
      },
      { purpose: 'shot.video-take', mediaKind: 'video', targetKind: 'sceneShotGroup' },
    ]);
  });

  it('exposes a draft preparation path for every registered purpose', () => {
    expect(
      listMediaGenerationPurposeDefinitions().map((definition) => ({
        purpose: definition.purpose,
        hasPrepareDraftSpec: typeof definition.prepareDraftSpec === 'function',
      }))
    ).toEqual(
      REGISTERED_PURPOSES.map((purpose) => ({
        purpose,
        hasPrepareDraftSpec: true,
      }))
    );
  });

  it('fails unsupported purpose lookup with a structured diagnostic', () => {
    expect(() =>
      requireMediaGenerationPurposeDefinition('obsolete.media-purpose')
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA387',
        message: expect.stringContaining('Unsupported media generation purpose'),
      })
    );
  });
});
