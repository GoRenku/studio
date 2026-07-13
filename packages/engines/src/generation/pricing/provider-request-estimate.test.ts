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
});
