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

  const invalidDocuments: Array<[string, unknown]> = [
    ['null', null],
    ['old version', { ...DEFAULT_PROJECT_SETTINGS, version: 0 }],
    ['new version', { ...DEFAULT_PROJECT_SETTINGS, version: 3 }],
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
          displayPreview: 'yes',
        },
      },
    ],
    ...[0, 1.5, 6].map<[string, unknown]>((maximum) => [
      `invalid maximum ${maximum}`,
      {
        ...DEFAULT_PROJECT_SETTINGS,
        generation: {
          ...DEFAULT_PROJECT_SETTINGS.generation,
          codexBuiltIn: {
            ...DEFAULT_PROJECT_SETTINGS.generation.codexBuiltIn,
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
