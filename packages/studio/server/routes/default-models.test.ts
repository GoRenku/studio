import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createDefaultModelsRoute } from './default-models.js';

describe('Default Model List route', () => {
  it('protects reads with the Studio runtime token', async () => {
    const app = createDefaultModelsRoute({ token: createStudioRuntimeToken(), read: async () => ({ state: 'notSynced' }) });
    expect((await app.request('/')).status).toBe(403);
  });

  it('returns notSynced from the Renku state directory before the first sync', async () => {
    const homeDir = await mkdtemp(path.join(os.tmpdir(), 'renku-default-models-route-'));
    try {
      const response = await createDefaultModelsRoute({ homeDir }).request('/');
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(await response.json()).toEqual({ resource: { state: 'notSynced' } });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it('serializes the synced lanes unchanged', async () => {
    const resource = {
      state: 'synced' as const,
      syncedAt: '2026-10-12T10:00:00.000Z',
      lanes: {
        image: [],
        imageEdit: [{ model: 'fictional-edit', name: 'Fictional Edit', providers: ['provider-one'], recommendedFor: ['provider-one'] }],
        video: [],
        audio: [],
      },
    };
    const response = await createDefaultModelsRoute({ read: async () => resource }).request('/');
    expect(await response.json()).toEqual({ resource });
  });
});
