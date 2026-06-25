// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreTrashItem } from './studio-trash-api';

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function lastCall() {
  const fetchMock = vi.mocked(global.fetch);
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
}

describe('studio-trash-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores a Trash item with the Studio bootstrap API token', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({
        report: {
          valid: true,
          warnings: [],
          changes: [],
          resourceKeys: [],
          recovery: {
            operationId: 'trash_operation_001',
            trashItemIds: ['trash_item_001'],
            restorable: false,
            restoreCommand: {
              name: 'trash.restore',
              trashItemId: 'trash_item_001',
            },
          },
        },
      })
    );

    await restoreTrashItem('constantinople', 'trash_item_001');

    const [url, init] = lastCall();
    expect(String(url)).toBe('/studio-api/projects/constantinople/trash/restore');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': 'token-123',
      },
      body: JSON.stringify({ trashItemId: 'trash_item_001' }),
    });
  });
});
