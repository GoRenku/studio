import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createMarkdownAssetsRoute } from './markdown-assets.js';

function createMountedMarkdownAssetsRoute() {
  return new Hono().route(
    '/:projectName',
    createMarkdownAssetsRoute({
      projectData: fakeProjectDataService(),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('markdown assets Hono route', () => {
  it('reads Markdown asset content through ProjectDataService', async () => {
    const app = createMountedMarkdownAssetsRoute();

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: {
        assetId: 'asset_clip_summary',
        assetFileId: 'asset_file_clip_summary',
        projectRelativePath:
          'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
        content: 'Establish the movie.',
      },
    });
  });

  it('patches Markdown asset content through ProjectDataService', async () => {
    const app = createMountedMarkdownAssetsRoute();

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content',
      {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Frame the city as a strategic obsession.',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: {
        assetId: 'asset_clip_summary',
        assetFileId: 'asset_file_clip_summary',
        projectRelativePath:
          'working-assets/base/sequences/01-opening/scenes/01-opening-scene/clips/01-opening-image/clip-summary.md',
        content: 'Frame the city as a strategic obsession.',
      },
      resourceKeys: [
        'markdown:asset_clip_summary:asset_file_clip_summary',
        'assets:clip:clip_1',
        'surface:clip-design:clip_1',
      ],
    });
  });

  it('rejects malformed content updates', async () => {
    const app = createMountedMarkdownAssetsRoute();

    const response = await app.request(
      '/constantinople/markdown-assets/asset_clip_summary/files/asset_file_clip_summary/content',
      {
        method: 'PATCH',
        body: JSON.stringify({
          content: 42,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER014',
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'STUDIO_SERVER010',
            message: 'content must be a string.',
          }),
        ]),
      },
    });
  });
});
