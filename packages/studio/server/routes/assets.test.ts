import fs from 'node:fs/promises';
import type { Asset } from '@gorenku/studio-core/client';
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

  it('deletes cast member assets through ProjectDataService', async () => {
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/cast/cast_narrator/assets/asset_cast_reference',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assetId: 'asset_cast_reference',
      resourceKeys: [
        'assets:castMember:cast_narrator',
        'surface:castMember:cast_narrator',
      ],
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

  it('lists, selects, unselects, deletes, and serves grouped location environment sheet files through ProjectDataService', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('location bytes'));
    const discardAsset = vi.fn(async () => ({
      valid: true as const,
      warnings: [],
      project: { id: 'project_test0001', name: 'constantinople' },
      changes: [{ type: 'asset.discarded', assetId: 'asset_location_reference' }],
      recovery: {
        operationId: 'trash_operation_test0001',
        trashItemIds: ['trash_item_test0001'],
        restorable: true,
        restoreCommand: {
          name: 'trash.restore' as const,
          trashItemId: 'trash_item_test0001',
        },
      },
      resourceKeys: [],
    }));
    const locationAsset = {
      ...makeAsset('asset_location_reference'),
      relationshipId: 'location_asset_test0001',
      target: { kind: 'location' as const, locationId: 'location_gate' },
      type: 'location_environment_sheet',
      role: 'environment_sheet',
      title: 'Gate environment sheet',
      files: [
        {
          ...makeAsset('asset_location_reference').files[0]!,
          id: 'asset_file_location_primary',
          role: 'primary',
          projectRelativePath:
            'locations/gate/environment-sheets/gate/sheet.png' as Asset['files'][number]['projectRelativePath'],
        },
      ],
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
          discardAsset,
          async resolveProjectAssetFile(input) {
            expect(input.target).toEqual({
              kind: 'location',
              locationId: 'location_gate',
            });
            return {
              asset: locationAsset,
              file: locationAsset.files[0]!,
              absolutePath:
                '/tmp/renku/constantinople/locations/gate/environment-sheets/gate/sheet.png',
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
    const deleted = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference',
      { method: 'DELETE' }
    );
    const file = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference/files/asset_file_location_primary'
    );

    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      assets: [
        {
          type: 'location_environment_sheet',
          role: 'environment_sheet',
          target: { kind: 'location', locationId: 'location_gate' },
          files: [{ role: 'primary' }],
        },
      ],
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
    expect(deleted.status).toBe(200);
    expect(discardAsset).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'location', locationId: 'location_gate' },
      assetId: 'asset_location_reference',
    });
    await expect(deleted.json()).resolves.toMatchObject({
      assetId: 'asset_location_reference',
      resourceKeys: [
        'assets:location:location_gate',
        'surface:location:location_gate',
      ],
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('image/png');
    await expect(file.text()).resolves.toBe('location bytes');
  });

  it('serves a storyboard shot file for a scene target', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('shot bytes'));
    const sceneAsset = {
      ...makeAsset('asset_scene_storyboard'),
      target: { kind: 'scene' as const, sceneId: 'scene_hook' },
      type: 'scene_storyboard_image',
      role: 'storyboard_image',
      files: [
        {
          ...makeAsset('asset_scene_storyboard').files[0]!,
          id: 'asset_file_shot_001',
          role: 'storyboard_image',
          projectRelativePath:
            'generated/storyboards/scene_hook/shot-001.png' as Asset['files'][number]['projectRelativePath'],
        },
      ],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async resolveProjectAssetFile(input) {
            expect(input.target).toEqual({
              kind: 'scene',
              sceneId: 'scene_hook',
            });
            expect(input.assetFileId).toBe('asset_file_shot_001');
            return {
              asset: sceneAsset,
              file: sceneAsset.files[0]!,
              absolutePath:
                '/tmp/renku/constantinople/generated/storyboards/scene_hook/shot-001.png',
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/scenes/scene_hook/assets/asset_scene_storyboard/files/asset_file_shot_001'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('shot bytes');
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
