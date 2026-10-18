import { StructuredError } from '@gorenku/studio-diagnostics';
import type { SampleFilm } from '@gorenku/studio-core/server';
import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createSampleFilmRoute, type SampleFilmRouteService } from './sample-film.js';

const downloading: SampleFilm = { archiveBytes: 375_000_000, inLibrary: false, installation: { state: 'downloading', receivedBytes: 0 } };

function service(): SampleFilmRouteService {
  return {
    read: vi.fn(async () => ({ archiveBytes: 375_000_000, inLibrary: false, installation: { state: 'idle' as const } })),
    start: vi.fn(async () => downloading),
  };
}

describe('Sample film route', () => {
  it('serializes the current sample film state', async () => {
    const app = createSampleFilmRoute({ token: createStudioRuntimeToken(), service: service() });

    const response = await app.request('/');

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      sampleFilm: { archiveBytes: 375_000_000, inLibrary: false, installation: { state: 'idle' } },
    });
  });

  it('requires the runtime token to start and delegates without a body', async () => {
    const token = createStudioRuntimeToken();
    const owner = service();
    const app = createSampleFilmRoute({ token, service: owner });

    expect((await app.request('/', { method: 'POST' })).status).toBe(403);
    const response = await app.request('/', { method: 'POST', headers: { 'X-Renku-Studio-Token': token.value } });

    await expect(response.json()).resolves.toEqual({ sampleFilm: downloading });
    expect(owner.start).toHaveBeenCalledOnce();
    expect(owner.start).toHaveBeenCalledWith();
  });

  it('maps a preflight error to 400 with the structured body', async () => {
    const token = createStudioRuntimeToken();
    const app = createSampleFilmRoute({ token, service: {
      read: service().read,
      start: async () => {
        throw new StructuredError({
          code: 'SAMPLE_FILM_FOLDER_IN_USE',
          message: 'The Project Library already has a folder that is not a Renku project.',
          suggestion: 'Move or rename that folder, then try again.',
        });
      },
    } });

    const response = await app.request('/', { method: 'POST', headers: { 'X-Renku-Studio-Token': token.value } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'SAMPLE_FILM_FOLDER_IN_USE', suggestion: 'Move or rename that folder, then try again.' },
    });
  });
});
