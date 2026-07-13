import { describe, expect, it } from 'vitest';
import { describeGenerationModelInputs } from './catalog/model-input-descriptors.js';
import { bindGenerationProductSettings } from './setting-fields.js';
import { listStudioModelAvailability } from './studio-model-availability.js';

describe('Studio generation model availability', () => {
  it('exposes only the accepted image create allowlist', async () => {
    const models = await listStudioModelAvailability({ mediaKind: 'image', use: 'create' });

    expect(models.map((model) => model.model)).toEqual([
      'openai/gpt-image-2',
      'nano-banana-2',
      'nano-banana-pro',
      'xai/grok-imagine-image',
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

  it('keeps the accepted video families while exposing direct provider endpoints', async () => {
    const models = await listStudioModelAvailability({ mediaKind: 'video' });

    expect(new Set(models.map((model) => model.label))).toEqual(new Set([
      'Seedance 2.0',
      'Seedance 2.0 Mini',
      'Seedance 2.0 Fast',
      'Kling V3 Standard 3.0',
      'Kling V3 Pro 3.0',
      'Kling O3 Standard O3',
      'Kling O3 Pro O3',
      'Veo 3.1',
      'XAI Grok Imagine Video 1.5',
      'LTX 3.2',
      'Alibaba Happy Horse',
    ]));
    expect(models.every((model) => model.provider === 'fal-ai')).toBe(true);
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: 'bytedance/seedance-2.0/text-to-video',
        label: 'Seedance 2.0',
      }),
    ]));
    expect([...new Set(models.map((model) => model.label))]).toEqual([
      'Seedance 2.0',
      'Seedance 2.0 Mini',
      'Seedance 2.0 Fast',
      'Kling V3 Standard 3.0',
      'Kling V3 Pro 3.0',
      'Kling O3 Standard O3',
      'Kling O3 Pro O3',
      'Veo 3.1',
      'XAI Grok Imagine Video 1.5',
      'LTX 3.2',
      'Alibaba Happy Horse',
    ]);
    expect(models.map((model) => model.model)).not.toEqual(
      expect.arrayContaining([
        'veo3.1/fast',
        'veo3.1/lite',
        'ltx-2.3/audio-to-video',
        'alibaba/happy-horse/video-edit',
        'kling-video/o3/standard/video-to-video/edit',
      ])
    );
  });
});
