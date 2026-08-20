// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSelectedProjectCover,
  deleteProjectCoverAsset,
  readProjectCoverAssets,
  selectProjectCoverAsset,
} from './studio-project-assets-api';

describe('Studio Project Cover Assets API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads every exact Project Cover page in Core order', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(okResponse({
        page: {
          items: [{ id: 'asset_newest' }],
          nextCursor: 'cursor/next',
          selectedAssetId: 'asset_newest',
        },
      }))
      .mockResolvedValueOnce(okResponse({
        page: {
          items: [{ id: 'asset_older' }],
          nextCursor: null,
          selectedAssetId: 'asset_newest',
        },
      }));

    const result = await readProjectCoverAssets('urban basilica');

    expect(result.items.map((asset) => asset.id)).toEqual([
      'asset_newest',
      'asset_older',
    ]);
    expect(result.selectedAssetId).toBe('asset_newest');
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/urban%20basilica/assets?ownerKind=project&type=project_cover&mediaKind=image&limit=200'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/urban%20basilica/assets?ownerKind=project&type=project_cover&mediaKind=image&limit=200&cursor=cursor%2Fnext'
    );
  });

  it('returns exact mutation reports from focused cover routes', async () => {
    const selectionReport = {
      valid: true,
      resourceKeys: ['surface:project:covers', 'project-shell', 'project-library'],
    };
    const discardReport = {
      valid: true,
      resourceKeys: ['surface:project:covers', 'trash:list'],
    };
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(okResponse(selectionReport))
      .mockResolvedValueOnce(okResponse(selectionReport))
      .mockResolvedValueOnce(okResponse(discardReport));

    await expect(
      selectProjectCoverAsset('urban basilica', 'asset/cover')
    ).resolves.toEqual(selectionReport);
    await expect(clearSelectedProjectCover('urban basilica')).resolves.toEqual(
      selectionReport
    );
    await expect(
      deleteProjectCoverAsset('urban basilica', 'asset/cover')
    ).resolves.toEqual(discardReport);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/urban%20basilica/selected-cover/asset%2Fcover',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'studio-token-test',
        },
        body: JSON.stringify({}),
      }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/urban%20basilica/selected-cover',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'studio-token-test',
        },
      }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/studio-api/projects/urban%20basilica/covers/asset%2Fcover',
      {
        method: 'DELETE',
        headers: {
          'X-Renku-Studio-Token': 'studio-token-test',
        },
      }
    );
  });
});

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
