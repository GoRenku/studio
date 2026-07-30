import { describe, expect, it } from 'vitest';
import { describeGenerationModelInputs } from './catalog/model-input-descriptors.js';
import { bindGenerationProductSettings } from './setting-fields.js';
import { listStudioModelAvailability } from './studio-model-availability.js';
import { listStudioVideoModelFamilies } from './studio-video-model-catalog.js';

describe('Studio generation model availability', () => {
  it('exposes every accepted image route from the family catalog', async () => {
    const models = await listStudioModelAvailability({ mediaKind: 'image' });

    expect(models.map((model) => model.model)).toEqual([
      'openai/gpt-image-2',
      'openai/gpt-image-2/edit',
      'nano-banana-2',
      'nano-banana-2/edit',
      'nano-banana-pro',
      'nano-banana-pro/edit',
      'xai/grok-imagine-image',
      'xai/grok-imagine-image/edit',
    ]);
    expect(models.some((model) => model.model.includes('seedream'))).toBe(false);
  });

  it('binds product settings through model metadata', async () => {
    const descriptor = await describeGenerationModelInputs({ provider: 'fal-ai', model: 'nano-banana-2' });
    expect(descriptor).not.toBeNull();

    const binding = bindGenerationProductSettings({
      descriptor: descriptor!,
      settings: [{ kind: 'aspect-ratio', value: '16:9' }, { kind: 'quality', value: 'medium' }],
    });

    expect(binding).toEqual({ valid: true, values: { aspect_ratio: '16:9', resolution: '2K' } });
  });

  it('derives video availability exactly from the ordered Studio video catalog', async () => {
    const models = await listStudioModelAvailability({ mediaKind: 'video' });
    const families = await listStudioVideoModelFamilies();

    expect(models).toEqual(families.flatMap((family) =>
      Object.values(family.routes).map((route) => ({
        provider: route.provider,
        model: route.model,
        label: family.label,
        mediaKind: 'video',
      }))
    ));
    expect(models).toHaveLength(9);
    expect(new Set(models.map((model) => model.label))).toEqual(new Set([
      'Seedance 2.0',
      'Seedance 2.0 Mini',
      'Seedance 2.0 Fast',
    ]));
  });
});
