import { StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createStudioUpdateRoute, type StudioUpdateRouteService } from './studio-update.js';

const available = { state: 'available' as const, installedVersion: '0.0.1', publishedVersion: '0.0.2' };

function service(): StudioUpdateRouteService {
  return {
    check: vi.fn(async () => available),
    start: vi.fn(async () => ({ started: true as const, publishedVersion: '0.0.2' })),
  };
}

describe('Studio update route', () => {
  it('requires the runtime token for reads and mutations', async () => {
    const app = createStudioUpdateRoute({ token: createStudioRuntimeToken(), service: service() });
    expect((await app.request('/')).status).toBe(403);
    expect((await app.request('/', { method: 'POST' })).status).toBe(403);
  });

  it('delegates the read and one body-free handoff', async () => {
    const token = createStudioRuntimeToken();
    const owner = service();
    const app = createStudioUpdateRoute({ token, service: owner });
    const headers = { 'X-Renku-Studio-Token': token.value };
    const read = await app.request('/', { headers });
    expect(read.headers.get('Cache-Control')).toBe('no-store');
    await expect(read.json()).resolves.toEqual({ status: available });
    const post = await app.request('/', { method: 'POST', headers });
    await expect(post.json()).resolves.toEqual({ started: true, publishedVersion: '0.0.2' });
    expect(owner.check).toHaveBeenCalledOnce();
    expect(owner.start).toHaveBeenCalledOnce();
    expect(owner.start).toHaveBeenCalledWith();
  });

  it('serializes structured check and handoff errors', async () => {
    const token = createStudioRuntimeToken();
    const app = createStudioUpdateRoute({ token, service: {
      check: async () => { throw new StructuredError({ code: 'UPDATE006', message: 'Offline.' }); },
      start: async () => { throw new StructuredError({ code: 'UPDATE009', message: 'No newer release.' }); },
    } });
    const headers = { 'X-Renku-Studio-Token': token.value };
    const check = await app.request('/', { headers });
    expect(check.status).toBe(500);
    await expect(check.json()).resolves.toMatchObject({ error: { code: 'UPDATE006' } });
    const post = await app.request('/', { method: 'POST', headers });
    expect(post.status).toBe(400);
    await expect(post.json()).resolves.toMatchObject({ error: { code: 'UPDATE009' } });
  });
});
