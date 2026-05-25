import { describe, expect, it } from 'vitest';
import type { LoadedModelCatalog } from '../model-catalog.js';
import { estimateGeneration } from './estimates.js';
import { listGenerationModels } from './model-discovery.js';
import { hashGenerationRequest } from './request-hash.js';

describe('generation estimates', () => {
  it('lists generation models by media kind', async () => {
    const catalog = createCatalog();

    await expect(
      listGenerationModels({ catalog, mediaKind: 'image' })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'fal-ai',
          model: 'image-model',
          mediaKind: 'image',
          modes: ['text-to-image'],
        }),
      ])
    );
  });

  it('estimates cost and creates an approval token for the exact request', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-model',
          mediaKind: 'image',
          parameters: { image_size: '1024x1024', quality: 'medium' },
        },
        request: {
          prompt: 'A test image',
          parameters: { num_images: 2 },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.06,
      approvalToken: expect.stringMatching(/^sha256:/),
      billableUnits: {
        image_size: '1024x1024',
        quality: 'medium',
        num_images: 2,
      },
    });
  });

  it('estimates image cost by resolution and output count', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'resolution-image-model',
          mediaKind: 'image',
        },
        request: {
          prompt: 'A test image',
          parameters: { resolution: '2K', num_images: 3 },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.36,
      billableUnits: {
        resolution: '2K',
        num_images: 3,
      },
    });
  });

  it('approval tokens hash the policy and request without the optional catalog', async () => {
    const catalog = createCatalog();
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
      parameters: { image_size: '1024x1024', quality: 'medium' },
    };
    const request = {
      prompt: 'A test image',
      parameters: { num_images: 2 },
    };

    await expect(
      estimateGeneration({
        catalog,
        policy,
        request,
      })
    ).resolves.toMatchObject({
      approvalToken: hashGenerationRequest({ policy, request }),
    });
  });
});

function createCatalog(): LoadedModelCatalog {
  return {
    providers: new Map([
      [
        'fal-ai',
        new Map([
          [
            'image-model',
            {
              name: 'image-model',
              type: 'image',
              mime: ['image/png'],
              price: {
                function: 'costByImageSizeAndQuality',
                inputs: ['image_size', 'quality', 'num_images'],
                prices: [
                  {
                    image_size: '1024x1024',
                    quality: 'medium',
                    pricePerImage: 0.03,
                  },
                ],
              },
            },
          ],
          [
            'resolution-image-model',
            {
              name: 'resolution-image-model',
              type: 'image',
              mime: ['image/png'],
              price: {
                function: 'costByImageAndResolution',
                inputs: ['resolution'],
                prices: [
                  {
                    resolution: '2K',
                    pricePerImage: 0.12,
                  },
                ],
              },
            },
          ],
        ]),
      ],
    ]),
  };
}
