// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateCastMemberVoiceOverStatus } from './studio-screenplay-api';

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

describe('studio-screenplay-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates a Cast Member voice-over flag', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({
        resource: {
          castMember: {
            id: 'cast_narrator',
            handle: 'narrator',
            name: 'Narrator',
            isVoiceOver: true,
          },
          voices: [],
        },
      })
    );

    await updateCastMemberVoiceOverStatus(
      'constantinople',
      'cast_narrator',
      true
    );

    const [url, init] = lastCall();
    expect(String(url)).toBe(
      '/studio-api/projects/constantinople/screenplay/cast/cast_narrator/voice-over'
    );
    expect(init).toMatchObject({
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Renku-Studio-Token': 'token-123',
      },
      body: JSON.stringify({ isVoiceOver: true }),
    });
  });
});
