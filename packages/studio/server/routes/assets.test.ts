import fs from 'node:fs/promises';
import type { Asset } from '@gorenku/studio-core/client';
import { createStructuredError } from '@gorenku/studio-diagnostics';
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
      '/constantinople/assets?ownerKind=castMember&ownerId=cast_narrator'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: {
        items: [
          {
            id: 'asset_cast_reference',
            owner: { kind: 'castMember', id: 'cast_narrator' },
          },
        ],
      },
    });
  });

  it('maps Shot candidate ownership and returns browser-safe file URLs', async () => {
    const shotAsset = {
      ...makeAsset('asset_shot_candidate'),
      owner: { kind: 'shot' as const, id: 'shot_wide' },
      type: 'shot_image',
      files: [
        {
          ...makeAsset('asset_shot_candidate').files[0]!,
          id: 'asset_file_shot_candidate',
          projectRelativePath:
            'generated/shot-wide.png' as Asset['files'][number]['projectRelativePath'],
        },
      ],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async listAssetPage(input) {
            expect(input).toMatchObject({
              owner: { kind: 'shot', id: 'shot_wide' },
              type: 'shot_image',
              mediaKind: 'image',
            });
            return {
              items: [shotAsset],
              nextCursor: null,
              selectedAssetId: shotAsset.id,
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/assets?ownerKind=shot&ownerId=shot_wide&type=shot_image&mediaKind=image'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toMatchObject({
      selectedAssetId: 'asset_shot_candidate',
      items: [
        {
          id: 'asset_shot_candidate',
          owner: { kind: 'shot', id: 'shot_wide' },
          files: [{
            id: 'asset_file_shot_candidate',
            url: '/studio-api/projects/constantinople/assets/asset_shot_candidate/files/asset_file_shot_candidate',
          }],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('projectRelativePath');
    expect(JSON.stringify(body)).not.toContain('generated/shot-wide.png');
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
          id: 'asset_cast_reference',
          owner: { kind: 'castMember', id: 'cast_narrator' },
          title: 'Narrator reference',
        },
      ],
    });
  });

  it('selects and clears the Cast Profile through ProjectDataService', async () => {
    const app = createMountedAssetsRoute();

    const selected = await app.request(
      '/constantinople/cast/cast_narrator/selected-profile/asset_cast_reference',
      { method: 'POST' }
    );
    const unselected = await app.request(
      '/constantinople/cast/cast_narrator/selected-profile',
      { method: 'DELETE' }
    );

    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      selectedAssetId: 'asset_cast_reference',
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      resourceKeys: expect.any(Array),
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
      valid: true,
      recovery: { restorable: true },
      resourceKeys: [],
    });
  });

  it('serves a registered cast member asset file', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('png bytes'));
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable'
    );
    await expect(response.text()).resolves.toBe('png bytes');
  });

  it('serves a project asset file through the generic asset-file route', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('generic bytes'));
    const app = createMountedAssetsRoute();

    const response = await app.request(
      '/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('generic bytes');
  });

  it('serves a project video file through the generic asset-file route', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('video bytes'));
    const videoFile = {
      id: 'asset_file_video_primary',
      role: 'primary',
      projectRelativePath:
        'generated/media/shot-video-take.mp4' as Asset['files'][number]['projectRelativePath'],
      mediaKind: 'video',
      mimeType: 'video/mp4',
      sizeBytes: 1234,
      contentHash: 'hash',
      width: null,
      height: null,
      durationSeconds: null,
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async resolveProjectAssetFileById(input) {
            expect(input.assetId).toBe('asset_video_take');
            expect(input.assetFileId).toBe('asset_file_video_primary');
            return {
              assetId: input.assetId,
              assetMediaKind: 'video',
              file: videoFile,
              absolutePath:
                '/tmp/renku/constantinople/generated/media/shot-video-take.mp4',
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/assets/asset_video_take/files/asset_file_video_primary'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    await expect(response.text()).resolves.toBe('video bytes');
  });

  it('rejects missing generic asset files without leaking absolute paths', async () => {
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async resolveProjectAssetFileById() {
            throw createStructuredError({
              code: 'CORE_PROJECT_ASSET_FILE_NOT_FOUND',
              message: 'Project asset file was not found.',
            });
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/assets/asset_missing/files/asset_file_missing'
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('CORE_PROJECT_ASSET_FILE_NOT_FOUND');
    expect(body).not.toContain('/tmp/renku');
  });

  it('lists, selects, unselects, deletes, and serves grouped Location Sheet files through ProjectDataService', async () => {
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
      resourceKeys: ['surface:location:location_gate'],
    }));
    const locationAsset = {
      ...makeAsset('asset_location_reference'),
      owner: { kind: 'location' as const, id: 'location_gate' },
      type: 'location_sheet',
      title: 'Gate Location Sheet',
      files: [
        {
          ...makeAsset('asset_location_reference').files[0]!,
          id: 'asset_file_location_primary',
          role: 'primary',
          projectRelativePath:
            'locations/gate/location-sheets/gate/sheet.png' as Asset['files'][number]['projectRelativePath'],
        },
      ],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetsRoute({
        projectData: {
          ...fakeProjectDataService(),
          async listAssetPage(input) {
            expect(input.owner).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              items: [locationAsset],
              nextCursor: null,
              selectedAssetId: 'asset_location_reference',
            };
          },
          async selectAsset(input) {
            expect(input.target).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              valid: true as const,
              warnings: [],
              project: {
                id: 'project_test0001',
                name: 'constantinople',
                projectFolder: '/tmp/renku/constantinople',
              },
              target: input.target,
              selectedAssetId: input.assetId,
              resourceKeys: ['surface:location:location_gate'],
            };
          },
          async clearAssetSelection(input) {
            expect(input.target).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              valid: true as const,
              warnings: [],
              project: {
                id: 'project_test0001',
                name: 'constantinople',
                projectFolder: '/tmp/renku/constantinople',
              },
              target: input.target,
              selectedAssetId: null,
              resourceKeys: ['surface:location:location_gate'],
            };
          },
          discardAsset,
          async resolveProjectAssetFileById(_input) {
            return {
              assetId: locationAsset.id,
              assetMediaKind: locationAsset.mediaKind,
              file: locationAsset.files[0]!,
              absolutePath:
                '/tmp/renku/constantinople/locations/gate/location-sheets/gate/sheet.png',
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
      '/constantinople/locations/location_gate/selected-hero/asset_location_reference',
      { method: 'POST' }
    );
    const unselected = await app.request(
      '/constantinople/locations/location_gate/selected-hero',
      { method: 'DELETE' }
    );
    const deleted = await app.request(
      '/constantinople/locations/location_gate/assets/asset_location_reference',
      { method: 'DELETE' }
    );
    const file = await app.request(
      '/constantinople/assets/asset_location_reference/files/asset_file_location_primary'
    );

    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      assets: [
        {
          type: 'location_sheet',
          owner: { kind: 'location', id: 'location_gate' },
          files: [{ role: 'primary' }],
        },
      ],
    });
    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      selectedAssetId: 'asset_location_reference',
      resourceKeys: [
        'surface:location:location_gate',
      ],
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      resourceKeys: expect.any(Array),
    });
    expect(deleted.status).toBe(200);
    expect(discardAsset).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'location', id: 'location_gate' },
      assetId: 'asset_location_reference',
    });
    await expect(deleted.json()).resolves.toMatchObject({
      valid: true,
      recovery: { restorable: true },
      resourceKeys: ['surface:location:location_gate'],
    });
    expect(file.status).toBe(200);
    expect(file.headers.get('Content-Type')).toBe('image/png');
    await expect(file.text()).resolves.toBe('location bytes');
  });

  it('serves a storyboard shot file for a scene target', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('shot bytes'));
    const sceneAsset = {
      ...makeAsset('asset_scene_storyboard'),
      owner: { kind: 'scene' as const, id: 'scene_hook' },
      type: 'scene_storyboard_image',
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
          async resolveProjectAssetFileById(input) {
            expect(input.assetFileId).toBe('asset_file_shot_001');
            return {
              assetId: sceneAsset.id,
              assetMediaKind: sceneAsset.mediaKind,
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
      '/constantinople/assets/asset_scene_storyboard/files/asset_file_shot_001'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('shot bytes');
  });

  it('rejects a malformed asset target', async () => {
    const app = createMountedAssetsRoute();

    const targetResponse = await app.request(
      '/constantinople/assets?ownerKind=castMember'
    );

    expect(targetResponse.status).toBe(400);
    await expect(targetResponse.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER033' },
    });
  });
});
