import { describe, expect, it } from 'vitest';
import { assembleGenerationProviderRequest } from './provider-request-assembly.js';

describe('generation provider request assembly', () => {
  it('preserves omission of optional provider defaults', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      values: { prompt: 'A quiet stone courtyard at dawn.' },
      references: [],
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      return;
    }
    expect(result.payload).toEqual({
      prompt: 'A quiet stone courtyard at dawn.',
    });
    expect(result.request.payload).not.toHaveProperty('quality');
    expect(result.request.payload).not.toHaveProperty('image_size');
  });

  it('retains a provider-default value when explicitly authored', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      values: {
        prompt: 'A quiet stone courtyard at dawn.',
        quality: 'high',
      },
      references: [],
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.quality).toBe('high');
    }
  });

  it('collects missing required values and media without repairing the request', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      values: {},
      references: [],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['values.prompt', 'references.image_urls'])
      );
    }
  });

  it('rejects media assigned to a text-only endpoint', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      values: { prompt: 'Preserve this exact prompt.' },
      references: [{
        providerField: 'image_urls',
        projectRelativePath: 'assets/reference.png',
        mediaKind: 'image',
        sourceIndex: 0,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'references.0.providerField' }),
      ]));
    }
  });

  it('preserves ordered exact references in an array provider field', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      values: { prompt: 'Preserve this exact prompt.' },
      references: [
        {
          providerField: 'image_urls',
          projectRelativePath: 'assets/second.png',
          mediaKind: 'image',
          sourceIndex: 3,
        },
        {
          providerField: 'image_urls',
          projectRelativePath: 'assets/first.png',
          mediaKind: 'image',
          sourceIndex: 1,
        },
      ],
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.image_urls).toEqual([
        'renku-input://assets/second.png',
        'renku-input://assets/first.png',
      ]);
      expect(result.request.inputFiles?.map((file) => file.projectRelativePath)).toEqual([
        'assets/second.png',
        'assets/first.png',
      ]);
    }
  });

  it('rejects knowable provider media size and dimension violations', async () => {
    const result = await assembleGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'kling-video/v3/pro/image-to-video',
      values: { prompt: 'A slow camera move through the courtyard.' },
      references: [{
        providerField: 'start_image_url',
        projectRelativePath: 'assets/source.png',
        mediaKind: 'image',
        sourceIndex: 0,
        mimeType: 'image/png',
        sizeBytes: 12_000_000,
        width: 200,
        height: 200,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.filter((issue) =>
        issue.path === 'references.0.reference'
      ).length).toBeGreaterThanOrEqual(3);
    }
  });
});
