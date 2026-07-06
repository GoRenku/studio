import { describe, expect, it } from 'vitest';
import { describeGenerationModelInputs } from './model-input-descriptors.js';

describe('generation model input descriptors', () => {
  it('describes GPT Image 2 text route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
    });

    expect(fieldNames(descriptor)).toEqual([
      'prompt',
      'image_size',
      'quality',
      'num_images',
      'output_format',
      'sync_mode',
    ]);
    expect(field(descriptor, 'image_size')).toMatchObject({
      label: 'Image Size',
      kind: 'dimensions',
      required: false,
      defaultValue: 'landscape_4_3',
      allowedValues: [
        'square_hd',
        'square',
        'portrait_4_3',
        'portrait_16_9',
        'landscape_4_3',
        'landscape_16_9',
      ],
    });
    expect(field(descriptor, 'quality')).toMatchObject({
      defaultValue: 'high',
      allowedValues: ['low', 'medium', 'high'],
    });
    expect(field(descriptor, 'num_images')).toMatchObject({
      minimum: 1,
      maximum: 4,
    });
  });

  it('describes GPT Image 2 edit route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
    });

    expect(fieldNames(descriptor)).toContain('image_urls');
    expect(field(descriptor, 'image_urls')).toMatchObject({
      required: true,
      kind: 'array',
    });
    expect(field(descriptor, 'image_size')).toMatchObject({
      kind: 'dimensions',
      defaultValue: 'auto',
      allowedValues: expect.arrayContaining(['auto', 'landscape_16_9']),
    });
  });

  it('describes Nano Banana 2 text route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'nano-banana-2',
    });

    expect(fieldNames(descriptor)).toEqual([
      'prompt',
      'num_images',
      'seed',
      'aspect_ratio',
      'output_format',
      'safety_tolerance',
      'sync_mode',
      'resolution',
      'limit_generations',
      'enable_web_search',
    ]);
    expect(field(descriptor, 'aspect_ratio')).toMatchObject({
      label: 'Aspect Ratio',
      kind: 'enum',
      defaultValue: '1:1',
      allowedValues: expect.arrayContaining(['auto', '16:9', '9:16']),
    });
    expect(field(descriptor, 'resolution')).toMatchObject({
      defaultValue: '1K',
      allowedValues: ['1K', '2K', '4K'],
    });
    expect(field(descriptor, 'seed')).toMatchObject({
      kind: 'integer',
      required: false,
    });
  });

  it('describes Nano Banana 2 edit route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'nano-banana-2/edit',
    });

    expect(fieldNames(descriptor)).toContain('image_urls');
    expect(field(descriptor, 'image_urls')).toMatchObject({
      required: true,
      kind: 'array',
    });
    expect(field(descriptor, 'aspect_ratio')).toMatchObject({
      defaultValue: 'auto',
      allowedValues: expect.arrayContaining(['auto', '16:9']),
    });
  });

  it('describes Grok Imagine text route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'xai/grok-imagine-image',
    });

    expect(field(descriptor, 'output_format')).toMatchObject({
      defaultValue: 'jpeg',
      allowedValues: ['jpeg', 'png', 'webp'],
    });
    expect(field(descriptor, 'resolution')).toMatchObject({
      defaultValue: '1k',
      allowedValues: ['1k', '2k'],
    });
  });

  it.each([
    'xai/grok-imagine-image/edit',
    'xai/grok-imagine-image/quality/edit',
  ])('describes Grok Imagine edit route fields for %s', async (model) => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model,
    });

    expect(fieldNames(descriptor)).toContain('image_urls');
    expect(field(descriptor, 'aspect_ratio')).toMatchObject({
      defaultValue: 'auto',
      allowedValues: expect.arrayContaining(['auto', '16:9']),
    });
    expect(field(descriptor, 'output_format')).toMatchObject({
      defaultValue: 'jpeg',
    });
  });

  it('describes Seedream v5 Lite text route fields', async () => {
    const descriptor = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'bytedance/seedream/v5/lite/text-to-image',
    });

    expect(fieldNames(descriptor)).toContain('image_size');
    expect(fieldNames(descriptor)).toContain('max_images');
    expect(fieldNames(descriptor)).toContain('enhance_prompt_mode');
    expect(fieldNames(descriptor)).not.toContain('output_format');
    expect(field(descriptor, 'num_images')).toMatchObject({
      minimum: 1,
      maximum: 6,
    });
  });
});

function fieldNames(
  descriptor: Awaited<ReturnType<typeof describeGenerationModelInputs>>
): string[] {
  return descriptor?.fields.map((field) => field.name) ?? [];
}

function field(
  descriptor: Awaited<ReturnType<typeof describeGenerationModelInputs>>,
  name: string
) {
  const match = descriptor?.fields.find((field) => field.name === name);
  expect(match).toBeTruthy();
  return match;
}
