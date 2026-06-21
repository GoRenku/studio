import { describe, expect, it } from 'vitest';
import type {
  LookbookImageGenerationContext,
  LookbookImageGenerationSpec,
} from '../../client/index.js';
import { buildLookbookImageProviderPayload } from './lookbook-image.js';

describe('Lookbook Image provider payload mapping', () => {
  it('rejects invalid focus sections before payload mapping reaches a provider', () => {
    expect(() =>
      buildLookbookImageProviderPayload(
        spec({
          focusSections: ['palette', 'bad_section'] as LookbookImageGenerationSpec['focusSections'],
        }),
        context()
      )
    ).toThrow(/Lookbook image sections failed validation/);
  });

  it('rejects unknown model choices with a structured Project Data diagnostic', () => {
    expect(() =>
      buildLookbookImageProviderPayload(
        spec({
          modelChoice:
            'fal-ai/nano-banana' as LookbookImageGenerationSpec['modelChoice'],
        }),
        context()
      )
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA274',
      })
    );
  });

  it('maps GPT Image 2 and rejects seed and 21:9', () => {
    expect(
      buildLookbookImageProviderPayload(
        spec({
          modelChoice: 'fal-ai/openai/gpt-image-2',
          takeCount: 2,
          detail: 'high',
          imageFrame: '16:9',
          outputFormat: 'webp',
        }),
        context()
      )
    ).toMatchObject({
      model: 'openai/gpt-image-2',
      outputCount: 2,
      payload: {
        num_images: 2,
        image_size: 'landscape_16_9',
        quality: 'high',
        output_format: 'webp',
      },
    });

    expect(() =>
      buildLookbookImageProviderPayload(
        spec({ modelChoice: 'fal-ai/openai/gpt-image-2', seed: 123 }),
        context()
      )
    ).toThrow(/seed/);

    expect(() =>
      buildLookbookImageProviderPayload(
        spec({ modelChoice: 'fal-ai/openai/gpt-image-2', imageFrame: '21:9' }),
        context()
      )
    ).toThrow(/21:9/);
  });

  it('maps Nano Banana 2 seed, 21:9, and detail resolution', () => {
    expect(
      buildLookbookImageProviderPayload(
        spec({
          modelChoice: 'fal-ai/nano-banana-2',
          takeCount: 4,
          seed: 123,
          detail: 'high',
          imageFrame: '21:9',
        }),
        context()
      )
    ).toMatchObject({
      model: 'nano-banana-2',
      outputCount: 4,
      payload: {
        num_images: 4,
        seed: 123,
        aspect_ratio: '21:9',
        resolution: '4K',
        limit_generations: true,
      },
    });
  });

  it('rejects Grok Imagine seed, 21:9, and non-standard detail', () => {
    expect(() =>
      buildLookbookImageProviderPayload(
        spec({ modelChoice: 'fal-ai/xai/grok-imagine-image', seed: 123 }),
        context()
      )
    ).toThrow(/seed/);

    expect(() =>
      buildLookbookImageProviderPayload(
        spec({ modelChoice: 'fal-ai/xai/grok-imagine-image', imageFrame: '21:9' }),
        context()
      )
    ).toThrow(/21:9/);

    expect(() =>
      buildLookbookImageProviderPayload(
        spec({ modelChoice: 'fal-ai/xai/grok-imagine-image', detail: 'high' }),
        context()
      )
    ).toThrow(/standard detail/);
  });

  it('maps Seedream v5 Lite take count and max_images', () => {
    expect(
      buildLookbookImageProviderPayload(
        spec({
          modelChoice: 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
          takeCount: 6,
          seed: 456,
          imageFrame: '9:16',
        }),
        context()
      )
    ).toMatchObject({
      model: 'bytedance/seedream/v5/lite/text-to-image',
      outputCount: 6,
      payload: {
        num_images: 6,
        max_images: 1,
        seed: 456,
        image_size: 'portrait_16_9',
      },
    });
  });
});

function spec(
  overrides: Partial<LookbookImageGenerationSpec> = {}
): LookbookImageGenerationSpec {
  return {
    purpose: 'lookbook.image',
    target: { kind: 'lookbook', id: 'lookbook_test' },
    modelChoice: 'fal-ai/nano-banana-2',
    prompt: 'A Lookbook image.',
    focusSections: ['palette'],
    takeCount: 1,
    seed: null,
    imageFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    ...overrides,
  };
}

function context(): LookbookImageGenerationContext {
  return {
    purpose: 'lookbook.image',
    target: { kind: 'lookbook', id: 'lookbook_test' },
    project: {
      id: 'project_test',
      name: 'test-project',
      title: 'Test Project',
      aspectRatio: '16:9',
    },
    lookbook: {
      id: 'lookbook_test',
      name: 'Test Lookbook',
      type: 'movie',
      definition: {
        thesis: { statement: 'A visual thesis.', principles: [] },
        palette: { description: 'A palette.', colors: [], observations: [] },
        toneMood: { tone: 'calm', moodTags: [], description: 'A mood.' },
        composition: { description: 'Composition.', patterns: [] },
        lighting: { description: 'Lighting.', patterns: [] },
        texture: { description: 'Texture.', observations: [] },
        camera: {
          description: 'Camera.',
          movement: [],
          motion: [],
          framing: [],
        },
      },
    },
    sourceInspirationFolders: [],
    existingImages: [],
    imagesBySection: {
      thesis: [],
      palette: [],
      toneMood: [],
      composition: [],
      lighting: [],
      texture: [],
      camera: [],
      styleBrief: [],
      lineAndFinish: [],
      valueAndAccent: [],
      guardrails: [],
    },
    cardImage: null,
    defaults: {
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      resolvedAspectRatio: '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    resourceKeys: [],
  };
}
