// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { studioApiFetch } from './studio-api-fetch';

const mutation = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Renku-Studio-Token': 'old' },
  body: JSON.stringify({ title: 'Unsaved work' }),
};
const rejectedToken = () => Response.json({ error: { code: 'STUDIO_SERVER021' } }, { status: 403 });

describe('Studio API token recovery', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'old' };
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a valid token without background renewal or additional requests', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }));
    await studioApiFetch('/studio-api/projects', mutation);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/studio-api/projects', mutation);
  });

  it('recovers after a server restart and preserves the request body and signal', async () => {
    const signal = new AbortController().signal;
    vi.mocked(fetch).mockResolvedValueOnce(rejectedToken())
      .mockResolvedValueOnce(Response.json({ studioApiToken: 'new' }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    expect((await studioApiFetch('/studio-api/projects', { ...mutation, signal })).ok).toBe(true);
    expect(fetch).toHaveBeenNthCalledWith(2, '/studio-api/bootstrap', {
      cache: 'no-store', headers: { 'X-Renku-Studio-Bootstrap': '1' },
    });
    expect(fetch).toHaveBeenNthCalledWith(3, '/studio-api/projects', {
      ...mutation, signal, headers: { ...mutation.headers, 'X-Renku-Studio-Token': 'new' },
    });
    expect(window.__RENKU_STUDIO_BOOTSTRAP__?.studioApiToken).toBe('new');
  });

  it('bootstraps a missing token once for concurrent requests', async () => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ studioApiToken: 'new' }))
      .mockImplementation(async () => Response.json({ ok: true }));
    await Promise.all([
      studioApiFetch('/studio-api/projects', mutation),
      studioApiFetch('/studio-api/projects', mutation),
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/studio-api/bootstrap')).toHaveLength(1);
  });

  it('retries an upload with the same bytes', async () => {
    const body = new Uint8Array([1, 2, 3]).buffer;
    vi.mocked(fetch).mockResolvedValueOnce(rejectedToken())
      .mockResolvedValueOnce(Response.json({ studioApiToken: 'new' }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    await studioApiFetch('/studio-api/projects/upload', { ...mutation, body });
    expect(vi.mocked(fetch).mock.calls[2]?.[1]?.body).toBe(body);
  });

  it('stops after one token retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(rejectedToken())
      .mockResolvedValueOnce(Response.json({ studioApiToken: 'new' }))
      .mockResolvedValueOnce(rejectedToken());
    expect((await studioApiFetch('/studio-api/projects', mutation)).status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([400, 403, 500])('does not retry an unrelated HTTP %s failure', async (status) => {
    const response = Response.json({ error: { code: 'OTHER' } }, { status });
    vi.mocked(fetch).mockResolvedValueOnce(response);
    expect(await studioApiFetch('/studio-api/projects', mutation)).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ error: { code: 'OTHER' } });
  });

  it('does not retry network failures', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'));
    await expect(studioApiFetch('/studio-api/projects', mutation)).rejects.toThrow('Network unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports invalid bootstrap data and allows recovery on a later request', async () => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({}));
    await expect(studioApiFetch('/studio-api/projects', mutation)).rejects.toMatchObject({ code: 'STUDIO_CLIENT002' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ studioApiToken: 'new' }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    expect((await studioApiFetch('/studio-api/projects', mutation)).ok).toBe(true);
  });

  it('does not send authentication to external URLs', async () => {
    await expect(studioApiFetch('https://example.com/upload', mutation)).rejects.toMatchObject({ code: 'STUDIO_CLIENT001' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
