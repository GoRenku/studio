import { describe, expect, it } from 'vitest';
import { buildImagePreviewConfiguration } from './model-input-configuration.js';

describe('image preview model input configuration', () => {
  it('shows GPT Image 2 effective payload values with schema defaults as metadata', async () => {
    const configuration = await buildImagePreviewConfiguration({
      provider: 'fal-ai',
      providerModel: 'openai/gpt-image-2',
      modelChoice: 'fal-ai/openai/gpt-image-2',
      modelLabel: 'GPT Image 2',
      payload: {
        prompt: 'Create a character sheet.',
        num_images: 2,
        image_size: 'landscape_16_9',
        quality: 'medium',
        output_format: 'png',
        sync_mode: false,
      },
    });

    expect(row(configuration, 'model')).toMatchObject({
      label: 'Model',
      value: 'fal-ai/openai/gpt-image-2',
      valueLabel: 'GPT Image 2',
    });
    expect(row(configuration, 'quality')).toMatchObject({
      value: 'medium',
      schemaDefault: 'high',
      providerField: 'quality',
      source: 'spec',
      presentation: 'parameter-control',
    });
    expect(allRowLabels(configuration)).not.toContain('Reference count');
    expect(allRowKeys(configuration)).not.toContain('prompt');
    expect(allRowKeys(configuration)).not.toContain('provider-route');
    expect(allRowKeys(configuration)).not.toContain('generation-route');
    expect(allRowKeys(configuration)).not.toContain('sync_mode');
    expect(allSectionKeys(configuration)).not.toContain('fixed-provider-settings');
  });

  it('shows Nano Banana 2 model-specific image rows without provider plumbing', async () => {
    const configuration = await buildImagePreviewConfiguration({
      provider: 'fal-ai',
      providerModel: 'nano-banana-2',
      modelChoice: 'fal-ai/nano-banana-2',
      modelLabel: 'Nano Banana 2',
      payload: {
        prompt: 'Create a character sheet.',
        num_images: 1,
        seed: null,
        aspect_ratio: '16:9',
        resolution: '2K',
        output_format: 'png',
        safety_tolerance: '4',
        limit_generations: true,
        enable_web_search: false,
        sync_mode: false,
      },
    });

    expect(row(configuration, 'aspect_ratio')).toMatchObject({
      value: '16:9',
      providerField: 'aspect_ratio',
    });
    expect(row(configuration, 'resolution')).toMatchObject({
      value: '2K',
      schemaDefault: '1K',
    });
    expect(row(configuration, 'seed')).toMatchObject({
      value: null,
      source: 'spec',
    });
    expect(allRowKeys(configuration)).not.toContain('image_size');
    expect(allRowKeys(configuration)).not.toContain('quality');
    expect(allRowKeys(configuration)).not.toContain('limit_generations');
    expect(allRowKeys(configuration)).not.toContain('safety_tolerance');
    expect(allRowKeys(configuration)).not.toContain('sync_mode');
  });

  it('shows Grok reference model inputs without route rows', async () => {
    const configuration = await buildImagePreviewConfiguration({
      provider: 'fal-ai',
      providerModel: 'xai/grok-imagine-image/edit',
      modelChoice: 'fal-ai/xai/grok-imagine-image',
      modelLabel: 'Grok Imagine',
      payload: {
        prompt: 'Create a character sheet.',
        image_urls: ['renku-input://generated/cast/source.png'],
        num_images: 1,
        aspect_ratio: '16:9',
        resolution: '1k',
        output_format: 'png',
        sync_mode: false,
      },
    });

    expect(row(configuration, 'aspect_ratio')).toMatchObject({
      value: '16:9',
      schemaDefault: 'auto',
    });
    expect(row(configuration, 'output_format')).toMatchObject({
      value: 'png',
      schemaDefault: 'jpeg',
    });
    expect(allRowKeys(configuration)).not.toContain('seed');
    expect(allRowKeys(configuration)).not.toContain('image_urls');
    expect(allRowKeys(configuration)).not.toContain('provider-route');
    expect(allRowKeys(configuration)).not.toContain('generation-route');
  });
});

function row(
  configuration: Awaited<ReturnType<typeof buildImagePreviewConfiguration>>,
  key: string
) {
  const match = configuration.sections
    .flatMap((section) => section.rows)
    .find((row) => row.key === key);
  expect(match).toBeTruthy();
  return match;
}

function allRowKeys(
  configuration: Awaited<ReturnType<typeof buildImagePreviewConfiguration>>
): string[] {
  return configuration.sections.flatMap((section) =>
    section.rows.map((row) => row.key)
  );
}

function allRowLabels(
  configuration: Awaited<ReturnType<typeof buildImagePreviewConfiguration>>
): string[] {
  return configuration.sections.flatMap((section) =>
    section.rows.map((row) => row.label)
  );
}

function allSectionKeys(
  configuration: Awaited<ReturnType<typeof buildImagePreviewConfiguration>>
): string[] {
  return configuration.sections.map((section) => section.key);
}
