// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readProviderCredentials,
  updateProviderCredentials,
} from './studio-provider-credentials-api';

describe('studio-provider-credentials-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the global resource with token and no-store behavior', async () => {
    vi.mocked(global.fetch).mockResolvedValue(successResponse());

    await expect(readProviderCredentials()).resolves.toEqual(resource());
    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/provider-credentials',
      {
        cache: 'no-store',
        headers: { 'X-Renku-Studio-Token': 'token-123' },
      }
    );
  });

  it('sends the exact update with token and no-store behavior', async () => {
    vi.mocked(global.fetch).mockResolvedValue(successResponse());
    const update = {
      changes: [
        { provider: 'fal-ai', value: 'test-secret' },
      ],
    };

    await updateProviderCredentials(update);

    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/provider-credentials',
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'token-123',
        },
        body: JSON.stringify(update),
      }
    );
  });

  it('preserves structured API errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: {
          code: 'PROVIDER_CREDENTIALS001',
          message: 'Provider credential update is invalid.',
          issues: [
            {
              code: 'PROVIDER_CREDENTIALS001',
              severity: 'error',
              message: 'API key must be a non-empty string.',
              location: { path: ['changes', '0', 'value'] },
            },
          ],
        },
      }),
    } as Response);

    await expect(
      updateProviderCredentials({
        changes: [{ provider: 'fal-ai', value: ' ' }],
      })
    ).rejects.toMatchObject({
      code: 'PROVIDER_CREDENTIALS001',
      issues: [{ location: { path: ['changes', '0', 'value'] } }],
    });
  });
});

function successResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ resource: resource() }),
  } as Response;
}

function resource() {
  return {
    providers: [
      {
        provider: 'fal-ai',
        label: 'fal.ai',
        configured: false,
      },
    ],
  };
}
