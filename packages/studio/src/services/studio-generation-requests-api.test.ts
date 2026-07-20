// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAssetFileGenerationRequest } from './studio-generation-requests-api';

describe('Studio generation requests API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the exact AssetFile request with the Studio token', async () => {
    const preview = { previewId: 'generation_preview_test' };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preview }),
    } as Response);

    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      assetId: 'asset/test',
      assetFileId: 'asset_file/test',
    })).resolves.toBe(preview);
    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/constantinople/assets/asset%2Ftest/files/asset_file%2Ftest/generation-request',
      { headers: { 'X-Renku-Studio-Token': 'studio-token-test' } },
    );
  });

  it('reads a structured inspection error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
          message: 'No saved request.',
        },
      }),
    } as Response);

    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      assetId: 'asset_test',
      assetFileId: 'asset_file_test',
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
    });
  });
});
