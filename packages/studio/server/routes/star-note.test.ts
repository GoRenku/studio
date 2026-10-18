import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createStarNoteRoute } from './star-note.js';

function post(app: ReturnType<typeof createStarNoteRoute>, token: string, body: string) {
  return app.request('/', {
    method: 'POST',
    headers: { 'X-Renku-Studio-Token': token, 'Content-Type': 'application/json' },
    body,
  });
}

describe('Star note route', () => {
  it('requires the runtime token', async () => {
    const app = createStarNoteRoute({ token: createStudioRuntimeToken(), offer: vi.fn() });

    expect((await app.request('/', { method: 'POST', body: '{"projectName":"night-market"}' })).status).toBe(403);
  });

  it('delegates the project name and serializes the offer', async () => {
    const token = createStudioRuntimeToken();
    const offer = vi.fn(async () => ({ show: true }));
    const app = createStarNoteRoute({ token, offer });

    const response = await post(app, token.value, '{"projectName":"night-market"}');

    await expect(response.json()).resolves.toEqual({ offer: { show: true } });
    expect(offer).toHaveBeenCalledWith({ projectName: 'night-market' });
  });

  it.each([
    ['a missing project name', '{}'],
    ['an extra field', '{"projectName":"night-market","force":true}'],
    ['a non-string project name', '{"projectName":7}'],
    ['invalid JSON', 'not json'],
  ])('rejects %s', async (_label, body) => {
    const token = createStudioRuntimeToken();
    const offer = vi.fn();
    const app = createStarNoteRoute({ token, offer });

    const response = await post(app, token.value, body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STUDIO_SERVER042' } });
    expect(offer).not.toHaveBeenCalled();
  });
});
