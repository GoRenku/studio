import { describe, expect, it } from 'vitest';
import { CATALOG_MODELS_ROOT } from '../../tests/test-catalog-paths.js';
import { loadModelCatalog } from '../model-catalog.js';
import { validateGenerationProviderPayload } from './provider-payload-validation.js';

describe('generation provider payload validation', () => {
  it('accepts the Lookbook Image payloads for the first supported fal.ai models', async () => {
    const catalog = await loadModelCatalog(CATALOG_MODELS_ROOT);

    await expect(
      validateGenerationProviderPayload({
        catalog,
        provider: 'fal-ai',
        model: 'openai/gpt-image-2',
        payload: {
          prompt: 'A Lookbook image.',
          num_images: 2,
          image_size: 'landscape_16_9',
          quality: 'medium',
          output_format: 'png',
          sync_mode: false,
        },
      })
    ).resolves.toBeUndefined();

    await expect(
      validateGenerationProviderPayload({
        catalog,
        provider: 'fal-ai',
        model: 'nano-banana-2',
        payload: {
          prompt: 'A Lookbook image.',
          num_images: 2,
          seed: 123,
          aspect_ratio: '21:9',
          resolution: '2K',
          output_format: 'png',
          safety_tolerance: '4',
          limit_generations: true,
          enable_web_search: false,
          sync_mode: false,
        },
      })
    ).resolves.toBeUndefined();

    await expect(
      validateGenerationProviderPayload({
        catalog,
        provider: 'fal-ai',
        model: 'xai/grok-imagine-image',
        payload: {
          prompt: 'A Lookbook image.',
          num_images: 1,
          aspect_ratio: '16:9',
          output_format: 'png',
          sync_mode: false,
        },
      })
    ).resolves.toBeUndefined();

    await expect(
      validateGenerationProviderPayload({
        catalog,
        provider: 'fal-ai',
        model: 'bytedance/seedream/v5/lite/text-to-image',
        payload: {
          prompt: 'A Lookbook image.',
          num_images: 3,
          max_images: 1,
          seed: null,
          image_size: 'landscape_16_9',
          enhance_prompt_mode: 'standard',
          enable_safety_checker: true,
          sync_mode: false,
        },
      })
    ).resolves.toBeUndefined();
  });

  it('rejects provider payload fields that are not in the model JSON schema', async () => {
    const catalog = await loadModelCatalog(CATALOG_MODELS_ROOT);

    await expect(
      validateGenerationProviderPayload({
        catalog,
        provider: 'fal-ai',
        model: 'openai/gpt-image-2',
        payload: {
          prompt: 'A Lookbook image.',
          num_images: 1,
          image_size: 'landscape_16_9',
          quality: 'medium',
          made_up_field: true,
        },
      })
    ).rejects.toThrow(/made_up_field/);
  });
});
