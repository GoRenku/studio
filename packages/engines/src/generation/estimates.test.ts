import { describe, expect, it } from 'vitest';
import type { LoadedModelCatalog } from '../model-catalog.js';
import {
  buildLogicalProviderPayload,
  estimateGeneration,
} from './estimates.js';
import {
  listGenerationModels,
  loadBundledGenerationCatalog,
} from './model-discovery.js';
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

    const estimate = await estimateGeneration({
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
    });

    expect(estimate).toMatchObject({
      estimatedCostUsd: 0.06,
      approvalToken: expect.stringMatching(/^sha256:/),
      billableUnits: {
        image_size: '1024x1024',
        quality: 'medium',
        num_images: 2,
      },
    });
    expect(estimate).not.toHaveProperty('approval');
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

  it('estimates bundled GPT Image 2 preset image sizes', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'openai/gpt-image-2',
          mediaKind: 'image',
        },
        request: {
          prompt: 'A test image',
          parameters: {
            image_size: 'landscape_4_3',
            quality: 'medium',
            num_images: 1,
            output_format: 'png',
            sync_mode: false,
          },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.037,
      approvalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates bundled GPT Image 2 edit custom image sizes', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'openai/gpt-image-2/edit',
          mediaKind: 'image',
          mode: 'image-edit',
        },
        request: {
          prompt: 'An edited source image.',
          parameters: {
            image_size: { width: 1536, height: 1152 },
            quality: 'medium',
            num_images: 1,
            output_format: 'png',
            sync_mode: false,
          },
          inputFiles: [
            {
              field: 'image_urls',
              projectRelativePath: 'generated/media/source-image.png',
              mediaKind: 'image',
              asArray: true,
              required: true,
            },
          ],
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.054,
      approvalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates video cost by duration, resolution, and input image count', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-to-video-model',
          mediaKind: 'video',
        },
        request: {
          prompt: 'A test camera move',
          parameters: { duration: 5, resolution: '720p' },
          inputFiles: [
            {
              field: 'image_url',
              projectRelativePath: 'generated/images/start-frame.png',
              mediaKind: 'image',
              required: true,
            },
          ],
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.7100000000000001,
      billableUnits: {
        duration: 5,
        resolution: '720p',
        image_url: 'renku-input://generated/images/start-frame.png',
      },
    });
  });

  it('estimates bundled Grok Imagine Video v1.5 image-to-video pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'xai/grok-imagine-video/v1.5/image-to-video',
          mediaKind: 'video',
        },
        request: {
          prompt: 'A smooth pan across a lobby.',
          parameters: { duration: 5, resolution: '480p' },
          inputFiles: [
            {
              field: 'image_url',
              projectRelativePath: 'generated/images/movement-pan-start.png',
              mediaKind: 'image',
              required: true,
            },
          ],
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.41000000000000003,
      approvalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates bundled Seedance 2.0 video token pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'bytedance/seedance-2.0/image-to-video',
          mediaKind: 'video',
        },
        request: {
          prompt: 'A locked-off shot of smoke moving across a wall.',
          parameters: {
            duration: '9',
            resolution: '720p',
            aspect_ratio: '16:9',
            generate_audio: true,
          },
          inputFiles: [
            {
              field: 'image_url',
              projectRelativePath: 'generated/images/walls-in-smoke.png',
              mediaKind: 'image',
              required: true,
            },
          ],
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 3.402,
      warnings: [],
      billableUnits: {
        duration: '9',
        resolution: '720p',
        aspect_ratio: '16:9',
      },
    });
  });

  it('estimates bundled fal.ai video duration pricing with audio', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'kling-video/v3/pro/image-to-video',
          mediaKind: 'video',
        },
        request: {
          prompt: 'A siege wall collapses through drifting smoke.',
          parameters: {
            duration: '9',
            generate_audio: true,
            cfg_scale: 0.5,
          },
          inputFiles: [
            {
              field: 'start_image_url',
              projectRelativePath: 'generated/images/kling-start.png',
              mediaKind: 'image',
              required: true,
            },
          ],
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 1.512,
      warnings: [],
      billableUnits: {
        duration: '9',
        generate_audio: true,
      },
    });
  });

  it('keeps unknown image size pricing unknown', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGeneration({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-model',
          mediaKind: 'image',
        },
        request: {
          prompt: 'A test image',
          parameters: {
            image_size: 'unknown_size',
            quality: 'medium',
            num_images: 1,
          },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: null,
      warnings: ['No pricing is configured for this model.'],
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

  it('adds logical input file URIs before provider payload validation', async () => {
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
      mode: 'image-edit' as const,
    };
    const request = {
      prompt: 'Use the source character sheet.',
      parameters: { num_images: 1 },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/character sheets/source image.png',
          mediaKind: 'image' as const,
          asArray: true,
          required: true,
        },
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/character sheets/style reference.png',
          mediaKind: 'image' as const,
          asArray: true,
          required: true,
        },
      ],
    };

    expect(buildLogicalProviderPayload(policy, request)).toMatchObject({
      prompt: 'Use the source character sheet.',
      image_urls: [
        'renku-input://cast/ada/character%20sheets/source%20image.png',
        'renku-input://cast/ada/character%20sheets/style%20reference.png',
      ],
    });
  });

  it('rejects duplicate scalar input file fields', () => {
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
      mode: 'image-edit' as const,
    };
    const request = {
      inputFiles: [
        {
          field: 'image_url',
          projectRelativePath: 'cast/ada/source.png',
          mediaKind: 'image' as const,
        },
        {
          field: 'image_url',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
        },
      ],
    };

    expect(() => buildLogicalProviderPayload(policy, request)).toThrow(
      /configured as a scalar but the payload already contains a value/
    );
  });

  it('rejects array input file fields when the payload already has a scalar value', () => {
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
      mode: 'image-edit' as const,
    };
    const request = {
      parameters: {
        image_urls: 'renku-input://cast/ada/source.png',
      },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
          asArray: true,
        },
      ],
    };

    expect(() => buildLogicalProviderPayload(policy, request)).toThrow(
      /configured as an array but the payload already contains a non-array value/
    );
  });

  it('does not mutate existing array parameters when appending input files', () => {
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
      mode: 'image-edit' as const,
    };
    const existingImageUrls = ['https://example.test/source.png'];
    const request = {
      parameters: {
        image_urls: existingImageUrls,
      },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
          asArray: true,
        },
      ],
    };

    expect(buildLogicalProviderPayload(policy, request)).toMatchObject({
      image_urls: [
        'https://example.test/source.png',
        'renku-input://cast/ada/style.png',
      ],
    });
    expect(existingImageUrls).toEqual(['https://example.test/source.png']);
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
          [
            'image-to-video-model',
            {
              name: 'image-to-video-model',
              type: 'video',
              mime: ['video/mp4'],
              price: {
                function: 'costByVideoDurationAndResolution',
                inputs: ['duration', 'resolution', 'image_url'],
                pricePerInputImage: 0.01,
                prices: [
                  {
                    resolution: '480p',
                    pricePerSecond: 0.08,
                  },
                  {
                    resolution: '720p',
                    pricePerSecond: 0.14,
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
