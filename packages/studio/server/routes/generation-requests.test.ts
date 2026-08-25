import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createGenerationRequestsRoute } from './generation-requests.js';

describe('Asset media generation request route', () => {
  it('inspects by Asset id without a file identity', async () => {
    const readAssetMediaGenerationRequest = vi.fn(async () => ({
      kind: 'mediaGenerationPreview' as const,
      provider: 'codex', model: 'gpt-image-2', mediaKind: 'image' as const, prompt: 'Stone arch',
      references: [], configuration: {}, editable: false, diagnostics: [],
    }));
    const app = new Hono().route('/:projectName', createGenerationRequestsRoute({
      projectData: { readAssetMediaGenerationRequest },
      requireToken: async (_c, next) => next(),
    }));
    const response = await app.request('/movie/assets/asset_1/generation-request');
    expect(response.status).toBe(200);
    expect(readAssetMediaGenerationRequest).toHaveBeenCalledWith({ projectName: 'movie', assetId: 'asset_1' });
    await expect(response.json()).resolves.toMatchObject({ preview: { editable: false } });
  });

  it('serves registered reference media without a request header', async () => {
    const requireToken = vi.fn(async (_c, next) => next());
    const app = new Hono().route('/:projectName', createGenerationRequestsRoute({
      projectData: {
        readAssetMediaGenerationRequest: vi.fn(),
      },
      requireToken,
    }));
    const response = await app.request('/movie/generation-reference-file?path=missing.png');

    expect(response.status).not.toBe(401);
    expect(requireToken).not.toHaveBeenCalled();
  });
});
