import { Hono } from 'hono';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createProductionPathRoute } from './production-path.js';

function createMountedProductionPathRoute(projectData = fakeProjectDataService()) {
  return new Hono().route('/:projectName', createProductionPathRoute({ projectData }));
}

describe('production path Hono route', () => {
  it('reads the Production Path', async () => {
    const app = createMountedProductionPathRoute();

    const response = await app.request('/constantinople/production-path');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: { nextStageId: 'screenplayAnalysis' },
    });
  });

  it('serializes project errors', async () => {
    const app = createMountedProductionPathRoute({
      ...fakeProjectDataService(),
      async readProductionPathResource() {
        throw createStructuredError({
          code: 'PROJECT_DATA001',
          message: 'Project was not found.',
        });
      },
    });

    const response = await app.request('/missing/production-path');

    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PROJECT_DATA001' },
    });
  });
});
