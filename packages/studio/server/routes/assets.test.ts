import fs from 'node:fs/promises';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAsset } from '../testing/route-fixtures.js';
import { createAssetsRoute } from './assets.js';

function createMountedAssetsRoute() {
  return new Hono().route(
    '/:projectName',
    createAssetsRoute({
      projectData: fakeProjectDataService(),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('assets Hono route', () => {
  it('lists filtered assets', async () => {
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/assets?targetKind=castMember&targetId=cast_narrator&selection=take'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            assetId: 'asset_cast_reference',
            target: { kind: 'castMember', castMemberId: 'cast_narrator' },
          },
        ],
      },
    });
  });

  it('lists cast member assets through ProjectDataService', async () => {
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/cast/cast_narrator/assets'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assets: [
        {
          assetId: 'asset_cast_reference',
          target: { kind: 'castMember', castMemberId: 'cast_narrator' },
          title: 'Narrator reference',
        },
      ],
    });
  });

  it('selects and unselects cast member assets through ProjectDataService', async () => {
    const app = createMountedAssetsRoute();

    const selected = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/select',
      { method: 'POST' }
    );
    const unselected = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/select',
      { method: 'DELETE' }
    );

    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      asset: {
        assetId: 'asset_cast_reference',
        selection: { kind: 'select', order: 1 },
      },
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      asset: {
        assetId: 'asset_cast_reference',
        selection: { kind: 'take' },
      },
    });
  });

  it('serves a registered cast member asset file', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('png bytes'));
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference/files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable'
    );
    await expect(response.text()).resolves.toBe('png bytes');
  });

  it('lists, selects, unselects, and serves location assets through ProjectDataService', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('location bytes'));
    const locationAsset = {
      ...makeAsset('asset_location_reference'),
      relationshipId: 'location_asset_test0001',
      target: { kind: 'location' as const, locationId: 'location_gate' },
      title: 'Gate reference',
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async listAssetPage(input) {
            expect(input.target).toEqual({
              kind: 'location',
              locationId: 'location_gate',
            });
            return { items: [locationAsset], nextCursor: null };
          },
          async createAssetSelect(input) {
            expect(input.target).toEqual({
              kind: 'location',
              locationId: 'location_gate',
            });
            return {
              ...locationAsset,
              selection: { kind: 'select' as const, order: 1 },
            };
          },
          async removeAssetSelect(input) {
            expect(input.target).toEqual({
              kind: 'location',
              locationId: 'location_gate',
            });
            return locationAsset;
          },
          async resolveProjectAssetFile(input) {
            expect(input.target).toEqual({
              kind: 'location',
              locationId: 'location_gate',
            });
            return {
              asset: locationAsset,
              file: locationAsset.files[0],
              absolutePath:
                '/tmp/renku/constantinople/working-assets/base/locations/gate/reference.png',
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const listed = await app.request(
      '/constantinople/locations/location_gate/assets'
    );
    const selected = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference/select',
      { method: 'POST' }
    );
    const unselected = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference/select',
      { method: 'DELETE' }
    );
    const file = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference/files/asset_file_cast_reference'
    );

    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      assets: [{ target: { kind: 'location', locationId: 'location_gate' } }],
    });
    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      asset: { selection: { kind: 'select', order: 1 } },
      resourceKeys: [
        'assets:location:location_gate',
        'surface:location:location_gate',
      ],
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      asset: { selection: { kind: 'take' } },
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('image/png');
    await expect(file.text()).resolves.toBe('location bytes');
  });

  it('rejects malformed asset target and selection query values', async () => {
    const app = createMountedAssetsRoute();

    const targetResponse = await app.request(
      '/constantinople/assets?targetKind=castMember'
    );
    const selectionResponse = await app.request(
      '/constantinople/assets?targetKind=project&selection=maybe'
    );

    expect(targetResponse.status).toBe(400);
    await expect(targetResponse.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER033' },
    });
    expect(selectionResponse.status).toBe(400);
    await expect(selectionResponse.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER031' },
    });
  });
});
