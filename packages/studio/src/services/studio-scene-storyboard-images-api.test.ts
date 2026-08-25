// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteStudioSceneStoryboardImage,
  selectStudioSceneStoryboardImage,
} from './studio-scene-storyboard-images-api';

describe('Studio Scene Storyboard images API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Core mutation reports from exact Beat candidate routes', async () => {
    const selectionReport = {
      valid: true,
      warnings: [],
      selectedAssetId: 'asset/one',
      resourceKeys: ['scene-beats:revision/one:beat:beat/one'],
    };
    const discardReport = {
      valid: true,
      warnings: [],
      changes: [],
      recovery: {
        operationId: 'trash_1',
        trashItemIds: ['trash_item_1'],
        restorable: true,
        restoreCommand: { name: 'trash.restore', trashItemId: 'trash_item_1' },
      },
      resourceKeys: ['scene-beats:revision/one:beat:beat/one'],
    };
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(okResponse(selectionReport))
      .mockResolvedValueOnce(okResponse(discardReport));
    const input = {
      projectName: 'urban basilica',
      sceneId: 'scene/one',
      sceneBeatsRevisionId: 'revision/one',
      beatId: 'beat/one',
      assetId: 'asset/one',
    };

    await expect(selectStudioSceneStoryboardImage(input)).resolves.toEqual(selectionReport);
    await expect(deleteStudioSceneStoryboardImage(input)).resolves.toEqual(discardReport);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/studio-api/projects/urban%20basilica/screenplay/scenes/scene%2Fone/scene-beats/revision%2Fone/beats/beat%2Fone/selected-image/asset%2Fone',
      mutation('POST'),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/studio-api/projects/urban%20basilica/screenplay/scenes/scene%2Fone/scene-beats/revision%2Fone/beats/beat%2Fone/images/asset%2Fone',
      mutation('DELETE'),
    );
  });
});

function okResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function mutation(method: 'POST' | 'DELETE'): RequestInit {
  return {
    method,
    headers: { 'X-Renku-Studio-Token': 'studio-token-test' },
  };
}
