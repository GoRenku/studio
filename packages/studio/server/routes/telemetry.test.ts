import { StructuredError } from '@gorenku/studio-diagnostics';
import type { TelemetryStatus } from '@gorenku/studio-core/client';
import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createTelemetryRoute, type TelemetryRouteService } from './telemetry.js';

const status: TelemetryStatus = {
  enabled: true,
  installId: '0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10',
  blockedBy: 'DO_NOT_TRACK',
  debug: false,
};

function service(): TelemetryRouteService {
  return { read: vi.fn(async () => status), update: vi.fn(async () => status) };
}

describe('Usage statistics route', () => {
  it('requires the runtime token and serializes the status', async () => {
    const token = createStudioRuntimeToken();
    const app = createTelemetryRoute({ token, service: service() });

    expect((await app.request('/')).status).toBe(403);
    const response = await app.request('/', { headers: { 'X-Renku-Studio-Token': token.value } });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status });
  });

  it('delegates a choice to Core', async () => {
    const token = createStudioRuntimeToken();
    const owner = service();
    const app = createTelemetryRoute({ token, service: owner });

    const response = await app.request('/', {
      method: 'PUT',
      headers: { 'X-Renku-Studio-Token': token.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, heardAbout: 'hn' }),
    });

    await expect(response.json()).resolves.toEqual({ status });
    expect(owner.update).toHaveBeenCalledWith({ enabled: true, heardAbout: 'hn' });
  });

  it.each([
    ['a missing body', undefined],
    ['a non-boolean enabled', JSON.stringify({ enabled: 'yes' })],
    ['an unknown field', JSON.stringify({ enabled: true, source: 'x' })],
    ['a non-string answer', JSON.stringify({ enabled: true, heardAbout: 3 })],
  ])('rejects %s with STUDIO_SERVER362', async (_label, body) => {
    const token = createStudioRuntimeToken();
    const owner = service();
    const app = createTelemetryRoute({ token, service: owner });

    const response = await app.request('/', {
      method: 'PUT',
      headers: { 'X-Renku-Studio-Token': token.value, 'Content-Type': 'application/json' },
      body,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STUDIO_SERVER362' } });
    expect(owner.update).not.toHaveBeenCalled();
  });

  it('maps Core errors to a structured 400', async () => {
    const token = createStudioRuntimeToken();
    const app = createTelemetryRoute({ token, service: {
      read: async () => {
        throw new StructuredError({ code: 'CORE_TELEMETRY_FILE_INVALID', message: 'The usage statistics file is not valid.' });
      },
      update: service().update,
    } });

    const response = await app.request('/', { headers: { 'X-Renku-Studio-Token': token.value } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CORE_TELEMETRY_FILE_INVALID' } });
  });
});
