// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteStudioShotImageCandidate,
  deleteStudioShotPlan,
  listStudioSceneShotPlans,
  listStudioShotImageCandidates,
  setStudioShotSelectedImage,
} from './studio-shot-plans-api';

describe('Studio Shot Plans API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists one Scene through the encoded Shot Plans path and forwards abort', async () => {
    const controller = new AbortController();
    vi.mocked(global.fetch).mockResolvedValue(okResponse({
      sceneId: 'scene/one',
      shotPlans: [],
      warnings: [],
    }));

    await listStudioSceneShotPlans({
      projectName: 'urban basilica',
      sceneId: 'scene/one',
      signal: controller.signal,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/urban%20basilica/screenplay/scenes/scene%2Fone/shot-plans',
      { signal: controller.signal }
    );
  });

  it('loads fixed candidate pages in Core order and forwards abort', async () => {
    const controller = new AbortController();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(okResponse({
        page: {
          items: [{ id: 'asset_second' }, { id: 'asset_first' }],
          nextCursor: 'cursor/next',
          selectedAssetId: 'asset_first',
        },
      }))
      .mockResolvedValueOnce(okResponse({
        page: {
          items: [{ id: 'asset_third' }],
          nextCursor: null,
          selectedAssetId: 'asset_first',
        },
      }));

    const result = await listStudioShotImageCandidates({
      projectName: 'urban basilica',
      shotId: 'shot/one',
      signal: controller.signal,
    });

    expect(result.items.map((asset) => asset.id)).toEqual([
      'asset_second',
      'asset_first',
      'asset_third',
    ]);
    expect(result.selectedAssetId).toBe('asset_first');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/urban%20basilica/assets?ownerKind=shot&ownerId=shot%2Fone&type=shot_image&mediaKind=image&limit=200',
      { signal: controller.signal }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/urban%20basilica/assets?ownerKind=shot&ownerId=shot%2Fone&type=shot_image&mediaKind=image&limit=200&cursor=cursor%2Fnext',
      { signal: controller.signal }
    );
  });

  it('uses token-authenticated exact mutation paths without request bodies', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ valid: true }));

    await deleteStudioShotPlan({
      projectName: 'urban basilica',
      shotPlanId: 'plan/one',
    });
    await setStudioShotSelectedImage({
      projectName: 'urban basilica',
      shotId: 'shot/two',
      assetId: 'asset/three',
    });
    await deleteStudioShotImageCandidate({
      projectName: 'urban basilica',
      shotId: 'shot/two',
      assetId: 'asset/three',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/urban%20basilica/screenplay/shot-plans/plan%2Fone',
      mutation('DELETE')
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/urban%20basilica/screenplay/shots/shot%2Ftwo/selected-image/asset%2Fthree',
      mutation('POST')
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/studio-api/projects/urban%20basilica/screenplay/shots/shot%2Ftwo/images/asset%2Fthree',
      mutation('DELETE')
    );
    expect(vi.mocked(global.fetch).mock.calls.every(([, init]) =>
      !init || !('body' in init)
    )).toBe(true);
  });

  it('retains structured errors from non-success responses', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'CORE_ASSET_SELECTION_INVALID',
          message: 'The image is not an eligible candidate.',
        },
      }),
    } as Response);

    await expect(
      setStudioShotSelectedImage({
        projectName: 'constantinople',
        shotId: 'shot_one',
        assetId: 'asset_one',
      })
    ).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_INVALID' });
  });
});

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function mutation(method: 'POST' | 'DELETE'): RequestInit {
  return {
    method,
    headers: { 'X-Renku-Studio-Token': 'studio-token-test' },
  };
}
