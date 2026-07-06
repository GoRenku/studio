import { describe, expect, it } from 'vitest';
import type { MediaGenerationPurpose } from '../../../client/index.js';
import {
  assertRegisteredMediaGenerationPurpose,
  listMediaGenerationPurposeDefinitions,
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';

const PURPOSES: MediaGenerationPurpose[] = [
  'lookbook.image',
  'lookbook.sheet',
  'cast.character-sheet',
  'cast.profile',
  'cast.voice-sample',
  'location.environment-sheet',
  'location.hero',
  'scene.storyboard-sheet',
  'scene.dialogue-audio',
  'shot.first-frame',
  'shot.last-frame',
  'shot.reference-image',
  'shot.video-prompt-sheet',
  'shot.video-take',
];

const PREVIEWABLE_PURPOSES: MediaGenerationPurpose[] = [
  'lookbook.image',
  'lookbook.sheet',
  'cast.character-sheet',
  'cast.profile',
  'location.environment-sheet',
  'location.hero',
  'scene.storyboard-sheet',
  'shot.first-frame',
  'shot.last-frame',
  'shot.reference-image',
  'shot.video-prompt-sheet',
  'shot.video-take',
];

describe('media generation lifecycle purpose registry', () => {
  it('registers each current purpose exactly once and returns a copy', () => {
    const definitions = listMediaGenerationPurposeDefinitions();
    definitions.pop();

    const currentDefinitions = listMediaGenerationPurposeDefinitions();
    expect(currentDefinitions.map((definition) => definition.purpose).sort())
      .toEqual([...PURPOSES].sort());
    expect(new Set(currentDefinitions.map((definition) => definition.purpose)).size)
      .toBe(PURPOSES.length);
  });

  it('requires focused behavior on every lifecycle purpose definition', () => {
    expect(
      listMediaGenerationPurposeDefinitions().map((definition) => ({
        purpose: definition.purpose,
        mediaKind: definition.mediaKind,
        targetKind: definition.targetKind,
        hasContext: typeof definition.buildContext === 'function',
        hasModels: typeof definition.listModels === 'function',
        hasValidate: typeof definition.validateSpec === 'function',
        hasCreate: typeof definition.createSpec === 'function',
        hasUpdate: typeof definition.updateSpec === 'function',
        hasList: typeof definition.listSpecs === 'function',
        hasPrepare: typeof definition.prepareSpec === 'function',
        hasPrepareDraft: typeof definition.prepareDraftSpec === 'function',
        hasRun: typeof definition.runSpec === 'function',
      })).sort((left, right) => left.purpose.localeCompare(right.purpose))
    ).toEqual(
      PURPOSES.map((purpose) => ({
        purpose,
        mediaKind: purpose === 'cast.voice-sample'
          ? 'audio'
          : purpose === 'scene.dialogue-audio'
            ? 'audio'
            : purpose === 'shot.video-take'
              ? 'video'
              : 'image',
        targetKind:
          purpose.startsWith('lookbook.')
            ? 'lookbook'
            : purpose.startsWith('cast.')
              ? 'castMember'
              : purpose.startsWith('location.')
                ? 'location'
                : purpose === 'scene.storyboard-sheet'
                  ? 'scene'
                  : purpose === 'scene.dialogue-audio'
                    ? 'sceneDialogue'
                    : 'sceneShotVideoTake',
        hasContext: true,
        hasModels: true,
        hasValidate: true,
        hasCreate: true,
        hasUpdate: true,
        hasList: true,
        hasPrepare: true,
        hasPrepareDraft: true,
        hasRun: true,
      })).sort((left, right) => left.purpose.localeCompare(right.purpose))
    );
  });

  it('looks up registered purposes and rejects obsolete purpose names', () => {
    expect(requireMediaGenerationPurposeDefinition('lookbook.image')).toMatchObject({
      purpose: 'lookbook.image',
      targetKind: 'lookbook',
    });
    expect(() => assertRegisteredMediaGenerationPurpose('obsolete.media-purpose'))
      .toThrow(
        expect.objectContaining({
          code: 'PROJECT_DATA387',
          suggestion: expect.stringContaining('registered media generation purposes'),
        })
      );
  });

  it('registers preview builders for every saved-spec previewable purpose', () => {
    const previewable = listMediaGenerationPurposeDefinitions()
      .filter((definition) => typeof definition.buildPreview === 'function')
      .map((definition) => definition.purpose)
      .sort();

    expect(previewable).toEqual([...PREVIEWABLE_PURPOSES].sort());
  });
});
