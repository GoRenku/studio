import { describe, expect, it } from 'vitest';
import { validateGenerationPreviewSnapshot } from './validation.js';

describe('generation preview validation', () => {
  it('accepts a valid motion annotation prompt-sheet preview', () => {
    expect(validateGenerationPreviewSnapshot(previewFixture())).toMatchObject({
      kind: 'generationPreview',
      previewId: 'generation_preview_test',
      purpose: 'shot.video-prompt-sheet',
      promptSheetVisualStyleId: 'cinematic-realistic',
      promptSheetNotationModeId: 'motion-annotation',
    });
  });

  it('does not parse prompt text for panel structure', () => {
    const preview = previewFixture();
    preview.finalPrompt.text =
      'Create a single uncaptioned abstract timing wash with no panels and no shot labels.';

    expect(() => validateGenerationPreviewSnapshot(preview)).not.toThrow();
  });

  it('rejects local file paths in preview references', () => {
    const preview = previewFixture();
    const referenceWithPath = {
      ...preview.references[0],
      browserUrl: '/Users/keremk/secret.png',
    } as typeof preview.references[0];
    preview.references[0] = referenceWithPath;

    expect(() => validateGenerationPreviewSnapshot(preview)).toThrow(
      expect.objectContaining({
        code: 'CORE_GENERATION_PREVIEW_INVALID',
      })
    );
  });

  it('rejects previews without target shot ids', () => {
    const preview = previewFixture();
    preview.target.shotIds = [];

    expect(() => validateGenerationPreviewSnapshot(preview)).toThrow(
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

    expect(() => validateGenerationPreviewSnapshot(preview)).toThrow(
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
    purpose: 'shot.video-prompt-sheet',
    project: {
      id: 'project_test0001',
      name: 'constantinople',
    },
    target: {
      kind: 'sceneShotVideoTake',
      id: 'take_test0001',
      sceneId: 'scene_test0001',
      takeId: 'take_test0001',
      shotIds: ['shot_test0001'],
    },
    title: 'Motion preview',
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image',
    },
    promptSheetVisualStyleId: 'cinematic-realistic',
    promptSheetNotationModeId: 'motion-annotation',
    finalPrompt: {
      text: 'Create an annotated video prompt image.',
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
    configuration: [
      {
        key: 'image_size',
        label: 'Image size',
        value: '1024x768',
      },
    ],
    diagnostics: [],
  };
}
