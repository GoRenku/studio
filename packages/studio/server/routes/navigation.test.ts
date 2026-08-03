import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createNavigationRoute } from './navigation.js';

function createMountedNavigationRoute() {
  return new Hono().route(
    '/:projectName',
    createNavigationRoute({ projectData: fakeProjectDataService() })
  );
}

describe('navigation Hono route', () => {
  it('returns Cast navigation pages', async () => {
    const app = createMountedNavigationRoute();

    const response = await app.request('/constantinople/cast');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'cast_narrator',
            name: 'Narrator',
          },
        ],
      },
    });
  });

  it('returns structured errors for malformed pagination', async () => {
    const app = createMountedNavigationRoute();

    const response = await app.request('/constantinople/cast?limit=wide');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER030',
        issues: [
          {
            location: {
              path: ['limit'],
            },
          },
        ],
      },
    });
  });
});
