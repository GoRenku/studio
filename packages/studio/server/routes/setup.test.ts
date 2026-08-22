import { StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import { createStudioRuntimeToken } from '../studio-runtime-token.js';
import { createSetupRoute, type SetupRouteService } from './setup.js';

describe('Studio setup route', () => {
  it('protects setup reads and initialization with the runtime token', async () => {
    const token = createStudioRuntimeToken();
    const app = createSetupRoute({ token, service: setupService() });

    expect((await app.request('/')).status).toBe(403);
    expect((await app.request('/', { method: 'POST' })).status).toBe(403);
  });

  it('returns setup state with no-store caching', async () => {
    const service = setupService();
    const read = vi.spyOn(service, 'read');
    const app = createSetupRoute({ service });

    const response = await app.request('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(read).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      setup: {
        status: 'setupRequired',
        recommendedStorageRoot: '/Users/alex/Movies/Renku',
      },
    });
  });

  it('initializes through one body-free Core intent', async () => {
    const service = setupService();
    const initialize = vi.spyOn(service, 'initialize');
    const app = createSetupRoute({ service });

    const response = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageRoot: '/untrusted/path' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(initialize).toHaveBeenCalledWith();
    await expect(response.json()).resolves.toEqual({
      report: {
        status: 'created',
        setup: {
          status: 'configured',
          storageRoot: '/Users/alex/Movies/Renku',
        },
      },
    });
  });

  it('serializes structured Core failures', async () => {
    const app = createSetupRoute({
      service: {
        ...setupService(),
        async read() {
          throw new StructuredError({
            code: 'CONFIG006',
            message: 'Renku config version is unsupported.',
          });
        },
      },
    });

    const response = await app.request('/');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CONFIG006' },
    });
  });
});

function setupService(): SetupRouteService {
  return {
    async read() {
      return {
        status: 'setupRequired',
        recommendedStorageRoot: '/Users/alex/Movies/Renku',
      };
    },
    async initialize() {
      return {
        status: 'created',
        setup: {
          status: 'configured',
          storageRoot: '/Users/alex/Movies/Renku',
        },
      };
    },
  };
}
