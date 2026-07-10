import { describe, expect, it } from 'vitest';
import {
  validateGenerationPreviewRequest,
  validateStudioGenerationPreview,
} from './validation.js';

describe('generation preview validation', () => {
  it('accepts a valid image create preview', () => {
    expect(validateGenerationPreviewRequest(previewFixture())).toMatchObject({
      kind: 'generationPreview',
      previewId: 'generation_preview_test',
      purpose: 'image.create',
      target: { kind: 'project', id: 'project_test0001' },
    });
  });

  it.each([
    ['lookbook.image', { kind: 'lookbook', id: 'lookbook_main' }],
    ['lookbook.sheet', { kind: 'lookbook', id: 'lookbook_main' }],
    ['cast.character-sheet', { kind: 'castMember', id: 'cast_mehmed' }],
    ['cast.profile', { kind: 'castMember', id: 'cast_mehmed' }],
    ['location.environment-sheet', { kind: 'location', id: 'loc_basilica' }],
    ['location.hero', { kind: 'location', id: 'loc_basilica' }],
    ['scene.storyboard-sheet', { kind: 'scene', id: 'scene_opening' }],
    ['image.create', { kind: 'project', id: 'project_test0001' }],
    [
      'shot.video-take',
      {
        kind: 'sceneShotVideoTake',
        id: 'take_test0001',
        sceneId: 'scene_test0001',
        takeId: 'take_test0001',
        shotIds: ['shot_test0001'],
      },
    ],
  ])('accepts supported preview purpose %s', (purpose, target) => {
    const preview = {
      ...previewFixture(),
      purpose,
      target,
    };

    expect(() => validateGenerationPreviewRequest(preview)).not.toThrow();
  });

  it('rejects unknown preview purposes', () => {
    const preview = {
      ...previewFixture(),
      purpose: 'scene.dialogue-audio',
      promptSheetVisualStyleId: undefined,
      promptSheetNotationModeId: undefined,
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('does not parse prompt text for panel structure', () => {
    const preview = previewFixture();
    preview.finalPrompt.authoredText =
      'Create a single uncaptioned abstract timing wash with no panels and no shot labels.';

    expect(() => validateGenerationPreviewRequest(preview)).not.toThrow();
  });

  it('accepts an empty authored prompt when the provider preview text is present', () => {
    const preview = previewFixture();
    preview.finalPrompt.authoredText = '';
    preview.finalPrompt.providerText =
      'Shot 1: The provider-facing multi-prompt remains populated.';

    expect(() => validateGenerationPreviewRequest(preview)).not.toThrow();
  });

  it('rejects retired preview prompt field names', () => {
    const preview = previewFixture() as unknown as {
      finalPrompt: Record<string, unknown>;
    };
    preview.finalPrompt = {
      text: 'Retired prompt field.',
      providerText: 'Provider prompt.',
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'CORE_GENERATION_PREVIEW_PROMPT_FIELD_UNSUPPORTED',
          }),
        ]),
      }),
    );
  });

  it('rejects prompt-sheet metadata in saved generation previews', () => {
    const preview = {
      ...previewFixture(),
      promptSheetVisualStyleId: 'cinematic-realistic',
      promptSheetNotationModeId: 'motion-annotation',
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects browser URLs in logical preview request references', () => {
    const preview = previewFixture();
    const referenceWithPath = {
      ...preview.references[0],
      browserUrl: '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
    } as typeof preview.references[0];
    preview.references[0] = referenceWithPath;

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects previews without target shot ids', () => {
    const preview = {
      ...previewFixture(),
      purpose: 'shot.video-take',
      target: {
        kind: 'sceneShotVideoTake',
        id: 'take_test0001',
        sceneId: 'scene_test0001',
        takeId: 'take_test0001',
        shotIds: [],
      },
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects nested provider upload URLs in provider payload previews', () => {
    const preview = previewFixture();
    (preview as Record<string, unknown>).providerPreview = {
      provider: 'fal-ai',
      model: 'fal-ai/openai/gpt-image-2',
      payload: {
        images: [
          {
            url: 'https://v3.fal.media/files/private/generated.png',
          },
        ],
      },
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('accepts reference selection controls with the current field shape', () => {
    const preview = previewFixture();
    (preview.references[0] as Record<string, unknown>).selectionControl = {
      dependencyId: 'reference-image:shot:shot_test0001',
      required: false,
      defaultIncluded: true,
      editable: true,
      inclusionOverride: null,
    };

    expect(() => validateGenerationPreviewRequest(preview)).not.toThrow();
  });

  it('rejects the retired array-shaped configuration contract', () => {
    const preview = previewFixture();
    (preview as Record<string, unknown>).configuration = [
      {
        key: 'image_size',
        label: 'Image size',
        value: '1024x768',
      },
    ];

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects unsupported configuration row fields', () => {
    const preview = previewFixture();
    (preview.configuration.sections[0]!.rows[0] as Record<string, unknown>).payload =
      { prompt: 'hidden' };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects unsupported reference selection control fields', () => {
    const preview = previewFixture();
    (preview.references[0] as Record<string, unknown>).selectionControl = {
      dependencyId: 'reference-image:shot:shot_test0001',
      required: false,
      defaultIncluded: true,
      editable: true,
      inclusionOverride: null,
      localPreviewPath: 'asset-file-preview',
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects local paths inside reference selection controls', () => {
    const preview = previewFixture();
    (preview.references[0] as Record<string, unknown>).selectionControl = {
      dependencyId: '/Users/me/secret.png',
      required: false,
      defaultIncluded: true,
      editable: true,
      inclusionOverride: null,
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects audio references in cast character sheet previews', () => {
    const preview = {
      ...previewFixture(),
      purpose: 'cast.character-sheet',
      target: {
        kind: 'castMember',
        id: 'cast_mehmed',
        castMemberId: 'cast_mehmed',
      },
      references: [
        {
          kind: 'audio',
          role: 'voice-reference',
          label: 'Voice reference',
          assetId: 'asset_voice',
          assetFileId: 'asset_file_voice',
          selected: true,
        },
      ],
    };

    expect(() => validateGenerationPreviewRequest(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'CORE_GENERATION_PREVIEW_REFERENCE_KIND_UNSUPPORTED',
            message:
              'Cast character sheet generation preview references must be image references.',
          }),
        ]),
      })
    );
  });

  it('accepts Studio display previews with subject labels and resolved browser URLs', () => {
    expect(validateStudioGenerationPreview(studioPreviewFixture())).toMatchObject({
      subject: {
        projectLabel: 'Preparation of the Siege',
        sceneLabel: 'Opening council',
        takeLabel: 'Take 1',
        shotLabel: 'Shot 1',
      },
      references: [
        expect.objectContaining({
          browserUrl:
            '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
        }),
      ],
    });
  });

  it('rejects Studio display previews without resolved browser URLs', () => {
    const preview = studioPreviewFixture();
    delete (preview.references[0] as Record<string, unknown>).browserUrl;

    expect(() => validateStudioGenerationPreview(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });
});

function previewFixture() {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    purpose: 'image.create',
    project: {
      id: 'project_test0001',
      name: 'constantinople',
    },
    target: {
      kind: 'project',
      id: 'project_test0001',
    },
    title: 'Image create preview',
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image',
    },
    finalPrompt: {
      authoredText: 'Create a production reference image.',
      providerText: 'Create a production reference image.',
    },
    references: [
      {
        kind: 'image',
        role: 'style',
        label: 'Storyboard lookbook sheet',
        providerToken: '@Reference1',
        assetId: 'asset_style',
        assetFileId: 'asset_file_style',
        selected: true,
      },
    ],
    configuration: {
      sections: [
        {
          key: 'model-inputs',
          label: 'Model inputs',
          rows: [
            {
              key: 'image_size',
              label: 'Image size',
              value: 'landscape_16_9',
              providerField: 'image_size',
              schemaDefault: 'landscape_4_3',
              allowedValues: ['landscape_4_3', 'landscape_16_9'],
              required: false,
              source: 'spec',
              presentation: 'parameter-control',
            },
          ],
        },
      ],
    },
    diagnostics: [],
  };
}

function studioPreviewFixture() {
  return {
    ...previewFixture(),
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
    },
    subject: {
      projectLabel: 'Preparation of the Siege',
      sceneLabel: 'Opening council',
      takeLabel: 'Take 1',
      shotLabel: 'Shot 1',
    },
    references: [
      {
        ...previewFixture().references[0],
        browserUrl:
          '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
      },
    ],
  };
}
