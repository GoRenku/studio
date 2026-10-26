import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_SETTINGS,
  parseStoredProjectSettings,
  validateProjectSettingsDocument,
} from './document.js';

describe('Project Settings document', () => {
  it('accepts and preserves the exact current document', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    expect(validateProjectSettingsDocument(settings)).toEqual(settings);
    expect(parseStoredProjectSettings(JSON.stringify(settings))).toEqual(settings);
  });

  it('accepts a named lane model', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.video.model = { key: 'fictional-video-2.5', name: 'Fictional Video 2.5' };
    expect(validateProjectSettingsDocument(settings)).toEqual(settings);
  });

  const invalidDocuments: Array<[string, unknown]> = [
    ['null', null],
    ['old version', { ...DEFAULT_PROJECT_SETTINGS, version: 0 }],
    ['new version', { ...DEFAULT_PROJECT_SETTINGS, version: 11 }],
    [
      'missing field',
      {
        ...DEFAULT_PROJECT_SETTINGS,
        screenplayImport: {
          createContinuitySubjects: true,
          generateContinuityImages: false,
          runScreenplayAnalysis: false,
          generateSceneBeats: false,
        },
      },
    ],
    ['unknown field', { ...DEFAULT_PROJECT_SETTINGS, extra: true }],
    [
      'wrong type',
      {
        ...DEFAULT_PROJECT_SETTINGS,
        generation: {
          ...DEFAULT_PROJECT_SETTINGS.generation,
          enableProviderPromptExpansion: 'yes',
        },
      },
    ],
    [
      'missing lane',
      {
        ...DEFAULT_PROJECT_SETTINGS,
        generation: {
          enableProviderPromptExpansion: true,
          image: DEFAULT_PROJECT_SETTINGS.generation.image,
          video: DEFAULT_PROJECT_SETTINGS.generation.video,
          audio: DEFAULT_PROJECT_SETTINGS.generation.audio,
        },
      },
    ],
    ...[{ key: '', name: 'Empty' }, { key: 'Fictional Model', name: 'Spaces' }, { key: 'fictional' }].map<[string, unknown]>((model) => [
      `invalid lane model ${JSON.stringify(model)}`,
      {
        ...DEFAULT_PROJECT_SETTINGS,
        generation: {
          ...DEFAULT_PROJECT_SETTINGS.generation,
          imageEdit: { ...DEFAULT_PROJECT_SETTINGS.generation.imageEdit, model },
        },
      },
    ]),
    ...[0, 1.5, 6].map<[string, unknown]>((maximum) => [
      `invalid maximum ${maximum}`,
      {
        ...DEFAULT_PROJECT_SETTINGS,
        generation: {
          ...DEFAULT_PROJECT_SETTINGS.generation,
          image: {
            ...DEFAULT_PROJECT_SETTINGS.generation.image,
            maxConcurrentGenerations: maximum,
          },
        },
      },
    ]),
  ];

  it.each(invalidDocuments)('rejects %s with structured issues', (_name, value) => {
    expect(() => validateProjectSettingsDocument(value)).toThrowError(
      expect.objectContaining({
        code: 'PROJECT_SETTINGS002',
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'PROJECT_SETTINGS002' }),
        ]),
      })
    );
  });

  it('rejects malformed stored JSON', () => {
    expect(() => parseStoredProjectSettings('{')).toThrowError(
      expect.objectContaining({ code: 'PROJECT_SETTINGS002' })
    );
  });
});
