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
  it('returns sequence and scene navigation pages with counts', async () => {
    const app = createMountedNavigationRoute();

    const sequenceResponse = await app.request('/constantinople/sequences');
    const sceneResponse = await app.request(
      '/constantinople/sequences/seq_opening/scenes'
    );

    expect(sequenceResponse.status).toBe(200);
    await expect(sequenceResponse.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'seq_opening',
            sceneCount: 1,
          },
        ],
      },
    });
    expect(sceneResponse.status).toBe(200);
    await expect(sceneResponse.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'scene_opening',
            sequenceId: 'seq_opening',
          },
        ],
      },
    });
  });

  it('returns structured errors for malformed pagination', async () => {
    const app = createMountedNavigationRoute();

    const response = await app.request('/constantinople/sequences?limit=wide');

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
