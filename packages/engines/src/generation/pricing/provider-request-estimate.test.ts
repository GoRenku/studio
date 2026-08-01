import { describe, expect, it } from 'vitest';
import { estimateGenerationProviderRequest } from './provider-request-estimate.js';

describe('provider request pricing', () => {
  it('uses provider-owned defaults for pricing without materializing them in the payload', async () => {
    const payload = { prompt: 'A quiet courtyard at dawn.' };

    const estimate = await estimateGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      mediaKind: 'image',
      payload,
    });

    expect(estimate.state).toBe('priced');
    expect(payload).toEqual({ prompt: 'A quiet courtyard at dawn.' });
    expect(payload).not.toHaveProperty('quality');
    expect(payload).not.toHaveProperty('image_size');
  });

  it('prices MiniMax H3 reference images and video duration from media facts', async () => {
    const estimate = await estimateGenerationProviderRequest({
      provider: 'fal-ai',
      model: 'minimax/h3/reference-to-video',
      mediaKind: 'video',
      payload: {
        prompt: 'Image 1 defines the subject. Video 1 defines the motion.',
        duration: 5,
      },
      inputMediaCounts: { image: 6, video: 1, audio: 1 },
      inputMediaDurationSeconds: { video: 4 },
    });

    expect(estimate).toMatchObject({
      state: 'priced',
      estimatedCostUsd: 2.42,
      billableUnits: {
        duration: 5,
        inputImageCount: 6,
        inputVideoCount: 1,
        inputAudioCount: 1,
        inputVideoDurationSeconds: 4,
      },
    });
  });
});
