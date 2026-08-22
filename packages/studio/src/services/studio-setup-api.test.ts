// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeRenkuSetup, readRenkuSetup } from './studio-setup-api';

describe('Studio setup API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads setup with the runtime token and no-store caching', async () => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'token-123' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        setup: {
          status: 'setupRequired',
          recommendedStorageRoot: '/Users/alex/Movies/Renku',
        },
      })
    );

    await expect(readRenkuSetup()).resolves.toMatchObject({
      status: 'setupRequired',
    });
    expect(fetchMock).toHaveBeenCalledWith('/studio-api/setup', {
      cache: 'no-store',
      headers: { 'X-Renku-Studio-Token': 'token-123' },
    });
  });

  it('initializes setup without sending a path or request body', async () => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'token-123' };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        report: {
          status: 'created',
          setup: {
            status: 'configured',
            storageRoot: '/Users/alex/Movies/Renku',
          },
        },
      })
    );

    await expect(initializeRenkuSetup()).resolves.toMatchObject({
      status: 'created',
    });
    expect(fetchMock).toHaveBeenCalledWith('/studio-api/setup', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'X-Renku-Studio-Token': 'token-123' },
    });
  });
});

function response(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
