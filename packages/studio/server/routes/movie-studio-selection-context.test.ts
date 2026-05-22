import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createMovieStudioSelectionContextRoute } from './movie-studio-selection-context.js';

function createMountedMovieStudioSelectionContextRoute() {
  return new Hono().route(
    '/:projectName',
    createMovieStudioSelectionContextRoute({
      projectData: fakeProjectDataService(),
    })
  );
}

describe('movie studio selection context Hono route', () => {
  it('accepts supported selections', async () => {
    const app = createMountedMovieStudioSelectionContextRoute();

    const response = await app.request(
      '/constantinople/movie-studio-selection/context',
      {
        method: 'POST',
        body: JSON.stringify({
          selection: { type: 'castMember', id: 'cast_narrator' },
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      valid: true,
      selection: { type: 'castMember', id: 'cast_narrator' },
    });
  });

  it('rejects unsupported selection types', async () => {
    const app = createMountedMovieStudioSelectionContextRoute();

    const response = await app.request(
      '/constantinople/movie-studio-selection/context',
      {
        method: 'POST',
        body: JSON.stringify({
          selection: { type: 'prop', id: 'prop_1' },
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER034',
        issues: [
          {
            location: {
              path: ['selection', 'type'],
            },
          },
        ],
      },
    });
  });

  it('rejects missing IDs for ID-bearing selections', async () => {
    const app = createMountedMovieStudioSelectionContextRoute();

    const response = await app.request(
      '/constantinople/movie-studio-selection/context',
      {
        method: 'POST',
        body: JSON.stringify({
          selection: { type: 'scene' },
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER034',
        issues: [
          {
            location: {
              path: ['selection', 'id'],
            },
          },
        ],
      },
    });
  });
});
