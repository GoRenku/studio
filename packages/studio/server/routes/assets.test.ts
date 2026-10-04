import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { AssetFile } from '@gorenku/studio-core/client';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAssetFile } from '../testing/route-fixtures.js';
import { createAssetFilesRoute } from './asset-files.js';

function createMountedAssetFilesRoute() {
  return new Hono().route(
    '/:projectName',
    createAssetFilesRoute({
      projectData: fakeProjectDataService(),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('assets Hono route', () => {
  it('lists filtered assets', async () => {
    const app = createMountedAssetFilesRoute();

    const response = await app.request(
      '/constantinople/asset-files?ownerKind=castMember&ownerId=cast_narrator'
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

  it('accepts Prop ownership on the generic Asset page', async () => {
    const listAssetFilePage = vi.fn(
      async () => ({
        items: [],
        nextCursor: null,
        selectedAssetFileId: null,
      })
    );
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          listAssetFilePage,
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/asset-files?ownerKind=prop&ownerId=prop_cannon'
    );

    expect(response.status).toBe(200);
    expect(listAssetFilePage).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { kind: 'prop', id: 'prop_cannon' },
      })
    );
  });

  it('maps Shot candidate ownership and returns browser-safe file URLs', async () => {
    const shotAssetFile = {
      ...makeAssetFile('asset_shot_candidate'),
      owner: { kind: 'shot' as const, id: 'shot_wide' },
      type: 'shot_image',
      id: 'asset_file_shot_candidate', projectRelativePath:
            'generated/shot-wide.png' as AssetFile['projectRelativePath'],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          async listAssetFilePage(input) {
            expect(input).toMatchObject({
              owner: { kind: 'shot', id: 'shot_wide' },
              type: 'shot_image',
              mediaKind: 'image',
            });
            return {
              items: [shotAssetFile],
              nextCursor: null,
              selectedAssetFileId: shotAssetFile.id,
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/asset-files?ownerKind=shot&ownerId=shot_wide&type=shot_image&mediaKind=image'
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toMatchObject({
      selectedAssetFileId: 'asset_file_shot_candidate',
      items: [
        {
          id: 'asset_file_shot_candidate',
          owner: { kind: 'shot', id: 'shot_wide' },
          url: '/studio-api/projects/constantinople/asset-files/asset_file_shot_candidate',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('projectRelativePath');
    expect(JSON.stringify(body)).not.toContain('generated/shot-wide.png');
  });

  it('lists cast member assets through ProjectDataService', async () => {
    const app = createMountedAssetFilesRoute();

    const response = await app.request(
      '/constantinople/cast/cast_narrator/asset-files'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: { items: [
        {
          id: 'asset_cast_reference',
          owner: { kind: 'castMember', id: 'cast_narrator' },
          title: 'Narrator reference',
        },
      ] },
    });
  });

  it('selects and clears the Cast Profile through ProjectDataService', async () => {
    const app = createMountedAssetFilesRoute();

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
      selectedAssetFileId: 'asset_cast_reference',
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      resourceKeys: expect.any(Array),
    });
  });

  it('forwards Project Cover selection, clear, and discard intent to Core', async () => {
    const projectData = fakeProjectDataService();
    const selectAssetFile = vi.spyOn(projectData, 'selectAssetFile');
    const clearAssetFileSelection = vi.spyOn(projectData, 'clearAssetFileSelection');
    const discardAssetFile = vi.spyOn(projectData, 'discardAssetFile');
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData,
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const selected = await app.request(
      '/constantinople/selected-cover/asset_project_cover',
      { method: 'POST' }
    );
    const cleared = await app.request('/constantinople/selected-cover', {
      method: 'DELETE',
    });
    const discarded = await app.request(
      '/constantinople/covers/asset_project_cover',
      { method: 'DELETE' }
    );

    expect(selected.status).toBe(200);
    expect(cleared.status).toBe(200);
    expect(discarded.status).toBe(200);
    expect(selectAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'project' },
      assetFileId: 'asset_project_cover',
    });
    expect(clearAssetFileSelection).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'project' },
    });
    expect(discardAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'project' },
      assetFileId: 'asset_project_cover',
      expectedType: 'project_cover',
    });
  });

  it('deletes cast member assets through ProjectDataService', async () => {
    const app = createMountedAssetFilesRoute();

    const response = await app.request(
      '/constantinople/cast/cast_narrator/asset-files/asset_cast_reference',
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
    mockAssetFileStream('png bytes');
    const app = createMountedAssetFilesRoute();

    const response = await app.request(
      '/constantinople/asset-files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable'
    );
    await expect(response.text()).resolves.toBe('png bytes');
  });

  it('serves a project asset file through the generic asset-file route', async () => {
    mockAssetFileStream('generic bytes');
    const app = createMountedAssetFilesRoute();

    const response = await app.request(
      '/constantinople/asset-files/asset_file_cast_reference'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('generic bytes');
  });

  it('serves a project video file through the generic asset-file route', async () => {
    mockAssetFileStream('video bytes');
    const videoFile = {
      id: 'asset_file_video_primary',
      projectRelativePath:
        'generated/media/generated-media.mp4' as AssetFile['projectRelativePath'],
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
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          async resolveProjectAssetFileById(input) {
                        expect(input.assetFileId).toBe('asset_file_video_primary');
            return {
              assetFile: { ...makeAssetFile(videoFile.id), ...videoFile, mediaKind: 'video' },
              absolutePath:
                '/tmp/renku/constantinople/generated/media/generated-media.mp4',
            };
          },
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    const response = await app.request(
      '/constantinople/asset-files/asset_file_video_primary'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    await expect(response.text()).resolves.toBe('video bytes');
  });

  it('rejects missing generic asset files without leaking absolute paths', async () => {
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
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
      '/constantinople/asset-files/asset_file_missing'
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('CORE_PROJECT_ASSET_FILE_NOT_FOUND');
    expect(body).not.toContain('/tmp/renku');
  });

  it('lists, selects, unselects, deletes, and serves grouped Location Sheet files through ProjectDataService', async () => {
    mockAssetFileStream('location bytes');
    const discardAssetFile = vi.fn(async () => ({
      valid: true as const,
      warnings: [],
      project: { id: 'project_test0001', projectName: 'constantinople' },
      changes: [{ type: 'asset.discarded', assetFileId: 'asset_location_reference' }],
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
    const locationAssetFile = {
      ...makeAssetFile('asset_location_reference'),
      owner: { kind: 'location' as const, id: 'location_gate' },
      type: 'location_sheet',
      title: 'Gate Location Sheet',
      id: 'asset_file_location_primary', projectRelativePath:
            'locations/gate/location-sheets/gate/sheet.png' as AssetFile['projectRelativePath'],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          async listAssetFilePage(input) {
            expect(input.owner).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              items: [locationAssetFile],
              nextCursor: null,
              selectedAssetFileId: 'asset_location_reference',
            };
          },
          async selectAssetFile(input) {
            expect(input.target).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              valid: true as const,
              warnings: [],
              project: {
                id: 'project_test0001',
                projectName: 'constantinople',
                projectFolder: '/tmp/renku/constantinople',
              },
              target: input.target,
              selectedAssetFileId: input.assetFileId,
              resourceKeys: ['surface:location:location_gate'],
            };
          },
          async clearAssetFileSelection(input) {
            expect(input.target).toEqual({
              kind: 'location',
              id: 'location_gate',
            });
            return {
              valid: true as const,
              warnings: [],
              project: {
                id: 'project_test0001',
                projectName: 'constantinople',
                projectFolder: '/tmp/renku/constantinople',
              },
              target: input.target,
              selectedAssetFileId: null,
              resourceKeys: ['surface:location:location_gate'],
            };
          },
          discardAssetFile,
          async resolveProjectAssetFileById(_input) {
            return {
              assetFile: locationAssetFile,
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
      '/constantinople/locations/location_gate/asset-files'
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
      '/constantinople/locations/location_gate/asset-files/asset_location_reference',
      { method: 'DELETE' }
    );
    const file = await app.request(
      '/constantinople/asset-files/asset_file_location_primary'
    );

    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      page: { items: [
        {
          type: 'location_sheet',
          owner: { kind: 'location', id: 'location_gate' },
        },
      ] },
    });
    expect(selected.status).toBe(200);
    await expect(selected.json()).resolves.toMatchObject({
      selectedAssetFileId: 'asset_location_reference',
      resourceKeys: [
        'surface:location:location_gate',
      ],
    });
    expect(unselected.status).toBe(200);
    await expect(unselected.json()).resolves.toMatchObject({
      resourceKeys: expect.any(Array),
    });
    expect(deleted.status).toBe(200);
    expect(discardAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'location', id: 'location_gate' },
      assetFileId: 'asset_location_reference',
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
    mockAssetFileStream('shot bytes');
    const sceneAssetFile = {
      ...makeAssetFile('asset_scene_storyboard'),
      owner: { kind: 'scene' as const, id: 'scene_hook' },
      type: 'scene_storyboard_image',
      id: 'asset_file_shot_001', projectRelativePath:
            'generated/storyboards/scene_hook/shot-001.png' as AssetFile['projectRelativePath'],
    };
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          async resolveProjectAssetFileById(input) {
            expect(input.assetFileId).toBe('asset_file_shot_001');
            return {
              assetFile: sceneAssetFile,
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
      '/constantinople/asset-files/asset_file_shot_001'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    await expect(response.text()).resolves.toBe('shot bytes');
  });

  it('forwards Prop asset list, Hero selection, clear, and discard intent to Core', async () => {
    const listAssetFilePage = vi.fn(fakeProjectDataService().listAssetFilePage);
    const selectAssetFile = vi.fn(fakeProjectDataService().selectAssetFile);
    const clearAssetFileSelection = vi.fn(
      fakeProjectDataService().clearAssetFileSelection
    );
    const discardAssetFile = vi.fn(fakeProjectDataService().discardAssetFile);
    const app = new Hono().route(
      '/:projectName',
      createAssetFilesRoute({
        projectData: {
          ...fakeProjectDataService(),
          listAssetFilePage,
          selectAssetFile,
          clearAssetFileSelection,
          discardAssetFile,
        },
        requireToken: async (_c, next) => {
          await next();
        },
      })
    );

    expect(
      (await app.request('/constantinople/props/prop_cannon/asset-files')).status
    ).toBe(200);
    expect(
      (
        await app.request(
          '/constantinople/props/prop_cannon/selected-hero/asset_cannon',
          { method: 'POST' }
        )
      ).status
    ).toBe(200);
    expect(
      (
        await app.request('/constantinople/props/prop_cannon/selected-hero', {
          method: 'DELETE',
        })
      ).status
    ).toBe(200);
    expect(
      (
        await app.request(
          '/constantinople/props/prop_cannon/asset-files/asset_cannon',
          { method: 'DELETE' }
        )
      ).status
    ).toBe(200);

    expect(listAssetFilePage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        owner: { kind: 'prop', id: 'prop_cannon' },
      })
    );
    expect(selectAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'prop', id: 'prop_cannon' },
      assetFileId: 'asset_cannon',
    });
    expect(clearAssetFileSelection).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'prop', id: 'prop_cannon' },
    });
    expect(discardAssetFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'prop', id: 'prop_cannon' },
      assetFileId: 'asset_cannon',
    });
  });

  it('rejects a malformed asset target', async () => {
    const app = createMountedAssetFilesRoute();

    const targetResponse = await app.request(
      '/constantinople/asset-files?ownerKind=castMember'
    );

    expect(targetResponse.status).toBe(400);
    await expect(targetResponse.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER033' },
    });
  });
});

function mockAssetFileStream(contents: string): void {
  vi.spyOn(fs.promises, 'stat').mockResolvedValue({ size: Buffer.byteLength(contents) } as Awaited<ReturnType<typeof fs.promises.stat>>);
  vi.spyOn(fs, 'createReadStream').mockReturnValue(
    Readable.from([Buffer.from(contents)]) as unknown as fs.ReadStream
  );
}
