import { describe, expect, it } from 'vitest';
import type { LoadedModelCatalog } from '../../model-catalog.js';
import type {
  GenerationPolicy,
  GenerationRequest,
} from '../contracts.js';
import { estimateGenerationCost } from './estimate-generation-cost.js';
import {
  listGenerationModels,
  loadBundledGenerationCatalog,
} from '../catalog/model-discovery.js';

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
        }),
      ])
    );
  });

  it('estimates cost and creates a cost approval token from pricing facts', async () => {
    const catalog = createCatalog();

    const estimate = await estimateGenerationFromRequest({
      catalog,
      policy: {
        provider: 'fal-ai',
        model: 'image-model',
        mediaKind: 'image',
      },
      request: {
        payload: {
          prompt: 'A test image',
          image_size: '1024x1024',
          quality: 'medium',
          num_images: 2,
        },
      },
    });

    expect(estimate).toMatchObject({
      state: 'priced',
      estimatedCostUsd: 0.06,
      costApprovalToken: expect.stringMatching(/^sha256:/),
      billableUnits: {
        image_size: '1024x1024',
        quality: 'medium',
        outputCount: 2,
      },
    });
    expect(estimate).not.toHaveProperty('approval');
  });

  it('estimates image cost by resolution and output count', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'resolution-image-model',
          mediaKind: 'image',
        },
        request: {
          payload: {
            prompt: 'A test image', resolution: '2K', num_images: 3 },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.36,
      billableUnits: {
        resolution: '2K',
        outputCount: 3,
      },
    });
  });

  it('estimates bundled GPT Image 2 preset image sizes', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'openai/gpt-image-2',
          mediaKind: 'image',
        },
        request: {
          payload: {
            prompt: 'A test image',
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
      costApprovalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates bundled GPT Image 2 edit custom image sizes', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'openai/gpt-image-2/edit',
          mediaKind: 'image',
        },
        request: {
          payload: {
            prompt: 'An edited source image.',
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
      costApprovalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates video cost by duration, resolution, and input image count', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-to-video-model',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A test camera move', duration: 5, resolution: '720p' },
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
        inputImageCount: 1,
      },
    });
  });

  it('estimates video input image cost from typed pricing input counts', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-to-video-model',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A test camera move', duration: 5, resolution: '720p' },
          pricingInputCounts: { image: 1 },
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.7100000000000001,
      billableUnits: {
        duration: 5,
        resolution: '720p',
        inputImageCount: 1,
      },
    });
  });

  it('estimates bundled Grok Imagine Video v1.5 image-to-video pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'xai/grok-imagine-video/v1.5/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A smooth pan across a lobby.', duration: 5, resolution: '480p' },
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
      costApprovalToken: expect.stringMatching(/^sha256:/),
    });
  });

  it('estimates bundled Seedance 2.0 video token pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'bytedance/seedance-2.0/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A locked-off shot of smoke moving across a wall.',
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
      estimatedCostUsd: expect.closeTo(2.7216, 5),
      warnings: [],
      billableUnits: {
        duration: '9',
        resolution: '720p',
        aspect_ratio: '16:9',
      },
    });
  });

  it('estimates bundled Seedance 2.0 fast video token pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'bytedance/seedance-2.0/fast/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A locked-off shot of smoke moving across a wall.',
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
      estimatedCostUsd: expect.closeTo(2.17728, 5),
      warnings: [],
      billableUnits: {
        duration: '9',
        resolution: '720p',
        aspect_ratio: '16:9',
      },
    });
  });

  it('estimates bundled Seedance 2.0 mini video token pricing', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'bytedance/seedance-2.0/mini/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A locked-off shot of smoke moving across a wall.',
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
      estimatedCostUsd: expect.closeTo(1.3608, 5),
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
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'kling-video/v3/pro/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A siege wall collapses through drifting smoke.',
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

  it('estimates bundled Kling V3, O3, and create-voice pricing rows', async () => {
    const catalog = await loadBundledGenerationCatalog();
    const cases = [
      {
        model: 'kling-video/v3/standard/text-to-video',
        payload: { duration: '5', generate_audio: false },
        expected: 0.42,
      },
      {
        model: 'kling-video/v3/standard/text-to-video',
        payload: { duration: '5', generate_audio: true },
        expected: 0.63,
      },
      {
        model: 'kling-video/v3/standard/image-to-video',
        payload: { duration: '5', generate_audio: true, uses_voice_control: true },
        expected: 0.77,
      },
      {
        model: 'kling-video/v3/pro/text-to-video',
        payload: { duration: '5', generate_audio: false },
        expected: 0.56,
      },
      {
        model: 'kling-video/v3/pro/text-to-video',
        payload: { duration: '5', generate_audio: true },
        expected: 0.84,
      },
      {
        model: 'kling-video/v3/pro/image-to-video',
        payload: { duration: '5', generate_audio: true, uses_voice_control: true },
        expected: 0.98,
      },
      {
        model: 'kling-video/o3/standard/reference-to-video',
        payload: { duration: '5', generate_audio: false },
        expected: 0.42,
      },
      {
        model: 'kling-video/o3/standard/reference-to-video',
        payload: { duration: '5', generate_audio: true },
        expected: 0.56,
      },
      {
        model: 'kling-video/o3/pro/reference-to-video',
        payload: { duration: '5', generate_audio: false },
        expected: 0.56,
      },
      {
        model: 'kling-video/o3/pro/reference-to-video',
        payload: { duration: '5', generate_audio: true },
        expected: 0.7,
      },
      {
        model: 'kling-video/o3/standard/video-to-video/reference',
        payload: { duration: '5' },
        expected: 0.63,
      },
      {
        model: 'kling-video/o3/pro/video-to-video/reference',
        payload: { duration: '5' },
        expected: 0.84,
      },
    ];

    for (const testCase of cases) {
      const estimate = await estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: testCase.model,
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A measured camera move through the scene.',
            ...testCase.payload,
          },
          pricingInputCounts: {},
        },
      });
      expect(estimate.estimatedCostUsd).toBeCloseTo(testCase.expected, 6);
    }

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'kling-video/create-voice',
          mediaKind: 'json',
        },
        request: {
          payload: { voice_url: 'https://example.com/voice.mp3' },
          pricingInputCounts: {},
        },
      })
    ).resolves.toMatchObject({
      estimatedCostUsd: 0.007,
      warnings: [],
    });
  });

  it('keeps Kling V3 voice-control estimates unpriced when no price row matches', async () => {
    const catalog = await loadBundledGenerationCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'kling-video/v3/pro/image-to-video',
          mediaKind: 'video',
        },
        request: {
          payload: {
            prompt: 'A quiet character study.',
            duration: '5',
            generate_audio: false,
            uses_voice_control: true,
          },
          pricingInputCounts: {},
        },
      })
    ).resolves.toMatchObject({
      state: 'unpriced',
      estimatedCostUsd: null,
      reason: 'No matching pricing row is configured for the requested pricing inputs.',
    });
  });

  it('estimates bundled ElevenLabs text-to-speech pricing by character for every TTS model', async () => {
    const catalog = await loadBundledGenerationCatalog();
    const text = 'A thousand years of stone remembered the sound.';

    for (const model of [
      'eleven_v3',
      'eleven_multilingual_v2',
      'eleven_turbo_v2_5',
    ]) {
      await expect(
        estimateGenerationFromRequest({
          catalog,
          policy: {
            provider: 'elevenlabs',
            model,
            mediaKind: 'audio',
          },
          request: {
            payload: {
              text,
              voice: 'voice_urban',
            },
          },
        })
      ).resolves.toMatchObject({
        estimatedCostUsd: text.length * 0.0001,
        pricing: {
          function: 'costByCharacters',
          pricePerCharacter: 0.0001,
        },
        warnings: [],
        billableUnits: {
          characterCount: text.length,
        },
      });
    }
  });

  it('keeps unknown image size pricing unknown', async () => {
    const catalog = createCatalog();

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy: {
          provider: 'fal-ai',
          model: 'image-model',
          mediaKind: 'image',
        },
        request: {
          payload: {
            prompt: 'A test image',
            image_size: 'unknown_size',
            quality: 'medium',
            num_images: 1,
          },
        },
      })
    ).resolves.toMatchObject({
      state: 'unpriced',
      estimatedCostUsd: null,
      reason: 'No matching pricing row is configured for the requested pricing inputs.',
    });
  });

  it('cost approval tokens hash pricing facts without the optional catalog', async () => {
    const catalog = createCatalog();
    const policy = {
      provider: 'fal-ai',
      model: 'image-model',
      mediaKind: 'image' as const,
    };
    const request = {
      payload: {
        prompt: 'A test image',
        image_size: '1024x1024',
        quality: 'medium',
        num_images: 2,
      },
    };

    await expect(
      estimateGenerationFromRequest({
        catalog,
        policy,
        request,
      })
    ).resolves.toMatchObject({
      costApprovalToken: expect.stringMatching(/^sha256:/),
    });
  });

});

function estimateGenerationFromRequest(input: {
  catalog: LoadedModelCatalog;
  policy: GenerationPolicy;
  request: GenerationRequest;
}) {
  const payload: Record<string, unknown> = {
    ...(input.request.payload ?? {}),
  };
  const pricingCounts = input.request.pricingInputCounts ?? {};
  return estimateGenerationCost({
    catalog: input.catalog,
    priceKey: {
      provider: input.policy.provider,
      model: input.policy.model,
      mediaKind: input.policy.mediaKind,
    },
    pricingInputs: {
      outputCount:
        input.policy.outputCount ??
        numericPayloadValue(payload, 'num_images') ??
        numericPayloadValue(payload, 'numImages') ??
        numericPayloadValue(payload, 'count') ??
        1,
      inputImageCount:
        pricingCounts.image ??
        (input.request.inputFiles ?? []).filter(
          (file) => file.mediaKind === 'image'
        ).length,
      inputAudioCount:
        pricingCounts.audio ??
        (input.request.inputFiles ?? []).filter(
          (file) => file.mediaKind === 'audio'
        ).length,
      inputVideoCount:
        pricingCounts.video ??
        (input.request.inputFiles ?? []).filter(
          (file) => file.mediaKind === 'video'
        ).length,
      durationSeconds:
        numberOrStringPayloadValue(payload, 'duration_seconds') ??
        numberOrStringPayloadValue(payload, 'durationSeconds') ??
        numberOrStringPayloadValue(payload, 'duration'),
      characterCount:
        typeof payload.text === 'string'
          ? payload.text.length
          : typeof payload.prompt === 'string'
            ? payload.prompt.length
            : undefined,
      imageSize: payload.image_size as never,
      resolution: payload.resolution as never,
      aspectRatio: payload.aspect_ratio as never,
      quality: payload.quality as never,
      generateAudio: payload.generate_audio as never,
      usesVoiceControl: payload.uses_voice_control as never,
      numFrames: payload.num_frames as never,
      videoSize: payload.video_size as never,
      mode: payload.mode as never,
      musicLengthMs: payload.music_length_ms as never,
    },
  });
}

function numericPayloadValue(
  payload: Record<string, unknown>,
  key: string
): number | undefined {
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
}

function numberOrStringPayloadValue(
  payload: Record<string, unknown>,
  key: string
): number | string | undefined {
  const value = payload[key];
  return typeof value === 'number' || typeof value === 'string'
    ? value
    : undefined;
}

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
