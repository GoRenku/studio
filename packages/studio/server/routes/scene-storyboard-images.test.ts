import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAssetFile } from '../testing/route-fixtures.js';
import { createSceneStoryboardImagesRoute } from './scene-storyboard-images.js';

describe('Scene Storyboard image candidate routes', () => {
  it('delegates exact Scene, revision, Beat, and candidate identities', async () => {
    const assetFile = {
      ...makeAssetFile('asset_storyboard'),
      owner: { kind: 'sceneBeat' as const, sceneId: 'scene one', beatId: 'beat one' },
      type: 'scene_storyboard_image',
    };
    const readSceneStoryboardStatus = vi.fn(async () => ({
      valid: true as const,
      warnings: [],
      project: { projectName: 'movie', id: 'project_1', projectFolder: '/tmp/movie' },
      resourceKeys: ['surface:scene:scene one:beats'],
      sceneId: 'scene one',
      sceneBeatsRevisionId: 'revision one',
      beats: [{
        beatId: 'beat one', beatNumber: '1', images: [assetFile],
        selectedImageId: assetFile.id, needsStoryboardImage: false,
      }],
      missingBeatIds: [],
      readyBeatIds: ['beat one'],
    }));
    const selectSceneStoryboardImageCandidate = vi.fn(async (request) => ({
      valid: true as const,
      warnings: [],
      project: { projectName: request.projectName, id: 'project_1', projectFolder: '/tmp/movie' },
      target: { kind: 'sceneBeat' as const, sceneId: request.sceneId, beatId: request.beatId },
      selectedAssetFileId: request.assetFileId,
      resourceKeys: ['surface:scene:scene one:beats'],
    }));
    const discardSceneStoryboardImageCandidate = vi.fn(async (request) => ({
      valid: true as const,
      warnings: [],
      project: { projectName: request.projectName, id: 'project_1' },
      changes: [{ type: 'sceneBeat.storyboardImageDiscarded', itemId: request.assetFileId }],
      recovery: {
        operationId: 'trash_1',
        trashItemIds: ['trash_item_1'],
        restorable: true,
        restoreCommand: { name: 'trash.restore' as const, trashItemId: 'trash_item_1' },
      },
      resourceKeys: ['surface:scene:scene one:beats'],
    }));
    const projectData = {
      ...fakeProjectDataService(),
      readSceneStoryboardStatus,
      selectSceneStoryboardImageCandidate,
      discardSceneStoryboardImageCandidate,
    };
    const app = new Hono().route('/:projectName', createSceneStoryboardImagesRoute({
      projectData,
      requireToken: async (_c, next) => { await next(); },
    }));
    const base = '/movie/screenplay/scenes/scene%20one/scene-beats/revision%20one';

    const read = await app.request(`${base}/storyboard-images`);
    const selected = await app.request(
      `${base}/beats/beat%20one/selected-image/asset%20one`, { method: 'POST' },
    );
    const discarded = await app.request(
      `${base}/beats/beat%20one/images/asset%20one`, { method: 'DELETE' },
    );

    const expected = {
      projectName: 'movie', sceneId: 'scene one', sceneBeatsRevisionId: 'revision one',
      beatId: 'beat one', assetFileId: 'asset one',
    };
    expect(readSceneStoryboardStatus).toHaveBeenCalledWith({
      projectName: 'movie', sceneId: 'scene one', sceneBeatsRevisionId: 'revision one',
    });
    expect((await read.json()).status.beats[0].images[0].url)
      .toContain('/asset-files/asset_storyboard');
    expect(selectSceneStoryboardImageCandidate).toHaveBeenCalledWith(expected);
    expect(discardSceneStoryboardImageCandidate).toHaveBeenCalledWith(expected);
    expect(selected.status).toBe(200);
    expect(discarded.status).toBe(200);
  });
});
