import { describe, expect, it } from 'vitest';
import type { GenerationModelDescriptor } from '../../client/generation.js';
import {
  selectGenerationPreviewProviderField,
  validatedGenerationPreviewParameterValues,
} from './authoring.js';

describe('generation preview authoring', () => {
  it('routes an image reference to the sole semantic media input', () => {
    expect(
      selectGenerationPreviewProviderField({
        model: modelFixture(),
        mediaKind: 'image',
      })
    ).toBe('image_urls');
  });

  it('keeps ambiguous semantic media routing incomplete', () => {
    const model = modelFixture();
    model.fields.push({
      name: 'end_image_url',
      label: 'End Image',
      kind: 'string',
      required: false,
      semantic: { kind: 'media', role: 'last-frame' },
      media: {
        acceptedKinds: ['image'],
        cardinality: 'one',
        minimum: 0,
        maximum: 1,
      },
    });

    expect(
      selectGenerationPreviewProviderField({
        model,
        mediaKind: 'image',
      })
    ).toBeUndefined();
  });

  it('accepts only non-media model parameter names', () => {
    expect(
      validatedGenerationPreviewParameterValues(modelFixture(), {
        quality: 'high',
        num_images: 2,
      })
    ).toEqual({
      quality: 'high',
      num_images: 2,
    });
    expect(() =>
      validatedGenerationPreviewParameterValues(modelFixture(), {
        image_urls: ['project-image.png'],
      })
    ).toThrow('does not expose parameter image_urls');
  });
});

function modelFixture(): GenerationModelDescriptor {
  return {
    provider: 'fal-ai',
    model: 'openai/gpt-image-2/edit',
    label: 'GPT Image 2',
    mediaKind: 'image',
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        kind: 'string',
        required: true,
        semantic: { kind: 'authored-text', role: 'prompt' },
      },
      {
        name: 'image_urls',
        label: 'Image URLs',
        kind: 'array',
        required: true,
        semantic: { kind: 'media', role: 'reference-image' },
        media: {
          acceptedKinds: ['image'],
          cardinality: 'many',
          minimum: 1,
          maximum: null,
        },
      },
      {
        name: 'mask_url',
        label: 'Mask URL',
        kind: 'string',
        required: false,
        media: {
          acceptedKinds: ['image'],
          cardinality: 'one',
          minimum: 0,
          maximum: 1,
        },
      },
      {
        name: 'quality',
        label: 'Quality',
        kind: 'enum',
        required: false,
        allowedValues: ['low', 'medium', 'high'],
      },
      {
        name: 'num_images',
        label: 'Number of Images',
        kind: 'integer',
        required: false,
      },
    ],
  };
}
