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
import { listMediaGenerationDependencyKindDefinitions } from '../../src/server/media-generation/dependency-kind-registry.js';

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
      })).sort((left, right) => left.purpose.localeCompare(right.purpose))
    ).toEqual([
      { purpose: 'cast.character-sheet', mediaKind: 'image', targetKind: 'castMember' },
      { purpose: 'cast.profile', mediaKind: 'image', targetKind: 'castMember' },
      { purpose: 'cast.voice-sample', mediaKind: 'audio', targetKind: 'castMember' },
      { purpose: 'location.environment-sheet', mediaKind: 'image', targetKind: 'location' },
      { purpose: 'lookbook.image', mediaKind: 'image', targetKind: 'lookbook' },
      { purpose: 'lookbook.sheet', mediaKind: 'image', targetKind: 'lookbook' },
      { purpose: 'scene.dialogue-audio', mediaKind: 'audio', targetKind: 'sceneDialogue' },
      { purpose: 'scene.storyboard-sheet', mediaKind: 'image', targetKind: 'scene' },
      {
        purpose: 'shot.first-frame',
        mediaKind: 'image',
        targetKind: 'sceneShotVideoTake',
      },
      {
        purpose: 'shot.last-frame',
        mediaKind: 'image',
        targetKind: 'sceneShotVideoTake',
      },
      {
        purpose: 'shot.multi-shot-storyboard-sheet',
        mediaKind: 'image',
        targetKind: 'sceneShotVideoTake',
      },
      {
        purpose: 'shot.reference-image',
        mediaKind: 'image',
        targetKind: 'sceneShotVideoTake',
      },
      {
        purpose: 'shot.video-take',
        mediaKind: 'video',
        targetKind: 'sceneShotVideoTake',
      },
    ]);
  });

  it('exposes a draft preparation path for every registered purpose', () => {
    expect(
      listMediaGenerationPurposeDefinitions().map((definition) => ({
        purpose: definition.purpose,
        hasPrepareDraftSpec: typeof definition.prepareDraftSpec === 'function',
      })).sort((left, right) => left.purpose.localeCompare(right.purpose))
    ).toEqual(
      REGISTERED_PURPOSES.map((purpose) => ({
        purpose,
        hasPrepareDraftSpec: true,
      })).sort((left, right) => left.purpose.localeCompare(right.purpose))
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

  it('maps dependency kinds to the purpose that owns generated media', () => {
    expect(listMediaGenerationDependencyKindDefinitions()).toEqual([
      {
        dependencyKind: 'first-frame',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'shot.first-frame',
      },
      {
        dependencyKind: 'last-frame',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'shot.last-frame',
      },
      {
        dependencyKind: 'reference-image',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'shot.reference-image',
      },
      {
        dependencyKind: 'multi-shot-storyboard-sheet',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'shot.multi-shot-storyboard-sheet',
      },
      {
        dependencyKind: 'reference-audio',
        mediaKind: 'audio',
        cardinality: 'one',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'scene.dialogue-audio',
      },
      {
        dependencyKind: 'cast-character-sheet',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'cast-character-sheet',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'cast.character-sheet',
      },
      {
        dependencyKind: 'location-environment-sheet',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'location-environment-sheet',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'location.environment-sheet',
      },
      {
        dependencyKind: 'lookbook-sheet',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'lookbook-sheet',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'lookbook.sheet',
      },
      {
        dependencyKind: 'manual-attachment',
        mediaKind: 'image',
        cardinality: 'one',
        assetSelector: 'manual-attachment',
        missingInputBehavior: 'require-attachment',
      },
    ]);
  });
});
