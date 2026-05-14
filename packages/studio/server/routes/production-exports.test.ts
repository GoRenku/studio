import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createProductionExportsRoute } from './production-exports.js';

function createMountedProductionExportsRoute(
  exportInputs: unknown[] = []
) {
  return new Hono().route(
    '/:projectName',
    createProductionExportsRoute({
      projectData: {
        ...fakeProjectDataService(),
        async exportProductionAssets(input) {
          exportInputs.push(input);
          return {
            copiedFileCount: 1,
            skippedFileCount: 0,
            prunedFileCount: 0,
            unmanagedFileCount: 0,
            variants: [],
          };
        },
      },
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('production exports Hono route', () => {
  it('accepts an empty body as the default export request', async () => {
    const exportInputs: unknown[] = [];
    const app = createMountedProductionExportsRoute(exportInputs);

    const response = await app.request('/constantinople/production-export', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      summary: { copiedFileCount: 1 },
    });
    expect(exportInputs).toEqual([{ projectName: 'constantinople' }]);
  });

  it('accepts dryRun and fresh options', async () => {
    const exportInputs: unknown[] = [];
    const app = createMountedProductionExportsRoute(exportInputs);

    const response = await app.request('/constantinople/production-export', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true, fresh: true }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(exportInputs).toEqual([
      { projectName: 'constantinople', dryRun: true, fresh: true },
    ]);
  });

  it('rejects unsupported request fields', async () => {
    const app = createMountedProductionExportsRoute();

    const response = await app.request('/constantinople/production-export', {
      method: 'POST',
      body: JSON.stringify({ mode: 'full' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER020' },
    });
  });
});
