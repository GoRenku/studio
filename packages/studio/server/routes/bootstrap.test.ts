import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStudioBootstrapRoute } from './bootstrap.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';

describe('local Studio bootstrap', () => {
  it('returns the current token without caching', async () => {
    const app = new Hono().route('/studio-api/bootstrap', createStudioBootstrapRoute({ value: 'current' }));
    const response = await app.request('/studio-api/bootstrap', {
      headers: { 'X-Renku-Studio-Bootstrap': '1' },
    });
    expect(await response.json()).toEqual({ studioApiToken: 'current' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.each<Record<string, string>>([
    {},
    { 'X-Renku-Studio-Bootstrap': '1', Origin: 'https://example.com' },
    { 'X-Renku-Studio-Bootstrap': '1', Origin: 'http://localhost:9999' },
  ])('rejects unauthorized bootstrap requests: %j', async (headers) => {
    const app = createStudioBootstrapRoute({ value: 'current' });
    const response = await app.request('/', { headers });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'STUDIO_SERVER023' } });
  });

  it('does not authorize cross-origin preflight requests', async () => {
    const response = await createStudioBootstrapRoute({ value: 'current' }).request('/', {
      method: 'OPTIONS', headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Headers': 'X-Renku-Studio-Bootstrap',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('does not expire tokens after extended inactivity and rejects stale tokens before mutation', async () => {
    const token = createStudioRuntimeToken();
    const mutate = vi.fn(() => ({ ok: true }));
    const app = new Hono().use(createStudioApiTokenMiddleware(token)).post('/', (c) => c.json(mutate()));
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01'));
      expect((await app.request('/', { method: 'POST', headers: { 'X-Renku-Studio-Token': token.value } })).status).toBe(200);
      expect((await app.request('/', { method: 'POST', headers: { 'X-Renku-Studio-Token': 'stale' } })).status).toBe(403);
      expect(mutate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
