// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionGroup } from '@gorenku/studio-core/client';
import {
  clearShotVideoTakeInput,
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
  selectShotVideoTakeInput,
  updateShotCastCharacterSheetReference,
  updateShotCustomReferenceImages,
  updateShotLocationReference,
  updateShotLocationSheetReference,
  updateShotLocationViewReferences,
  updateShotVideoTakeProduction,
  updateShotVideoTakeRailGroups,
} from './studio-shot-video-takes-api';

const PRODUCTION_GROUP: ShotVideoTakeProductionGroup = {
  productionGroupId: 'scene_shot_video_take_group_001',
  shotIds: ['shot_001', 'shot_002'],
  videoTakeProduction: { inputModeId: 'reference' },
};

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function lastCall() {
  const fetchMock = vi.mocked(global.fetch);
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
}

function lastBody(): Record<string, unknown> {
  const [, init] = lastCall();
  return JSON.parse((init as RequestInit).body as string);
}

describe('studio-shot-video-takes-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads production with comma-separated shot ids', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, models: {} })
    );
    await readShotVideoTakeProduction('constantinople', 'scene_hook', [
      'shot_001',
      'shot_002',
    ]);
    const [url] = lastCall();
    expect(String(url)).toBe(
      '/studio-api/projects/constantinople/screenplay/scenes/scene_hook/video-take-production?shotIds=shot_001%2Cshot_002'
    );
  });

  it('autosaves the production group', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      PRODUCTION_GROUP
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain('/video-take-production');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({ productionGroup: PRODUCTION_GROUP });
  });

  it('applies rail groups atomically', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotVideoTakeRailGroups('constantinople', 'scene_hook', [
      {
        productionGroupId: 'group_upper',
        mergePartnerProductionGroupId: 'group_lower',
        shotIds: ['shot_001', 'shot_002', 'shot_003'],
      },
      {
        sourceProductionGroupId: 'group_source',
        shotIds: ['shot_004'],
      },
    ]);
    const [url, init] = lastCall();
    expect(String(url)).toContain('/video-take-production/rail-groups');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      railGroups: [
        {
          productionGroupId: 'group_upper',
          mergePartnerProductionGroupId: 'group_lower',
          shotIds: ['shot_001', 'shot_002', 'shot_003'],
        },
        {
          sourceProductionGroupId: 'group_source',
          shotIds: ['shot_004'],
        },
      ],
    });
  });

  it('reads the inline production plan report with the production group', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ report: {} }));
    await planShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      PRODUCTION_GROUP
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain('/video-take-production/plan');
    expect((init as RequestInit).method).toBe('POST');
    expect(lastBody()).toEqual({
      productionGroup: PRODUCTION_GROUP,
      inputPolicy: { defaultMode: 'auto' },
    });
  });

  it('estimates with the production group', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ estimate: {} }));
    await estimateShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      PRODUCTION_GROUP
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain('/video-take-production/estimate');
    expect((init as RequestInit).method).toBe('POST');
    expect(lastBody()).toEqual({ productionGroup: PRODUCTION_GROUP });
  });

  it('selects a reusable input with shotIds and inputId', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await selectShotVideoTakeInput(
      'constantinople',
      'scene_hook',
      ['shot_001'],
      'input_001'
    );
    const [url] = lastCall();
    expect(String(url)).toContain('/video-take-production/inputs/select');
    expect(lastBody()).toEqual({ shotIds: ['shot_001'], inputId: 'input_001' });
  });

  it('clears an input with shotIds, kind, and optional subject', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await clearShotVideoTakeInput('constantinople', 'scene_hook', ['shot_001'], {
      kind: 'first-frame',
      subjectKind: 'shot',
      subjectId: 'shot_001',
    });
    const [url] = lastCall();
    expect(String(url)).toContain('/video-take-production/inputs/clear');
    expect(lastBody()).toEqual({
      shotIds: ['shot_001'],
      kind: 'first-frame',
      subjectKind: 'shot',
      subjectId: 'shot_001',
    });
  });

  it('updates the shot location reference with only the scoped location id', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotLocationReference(
      'constantinople',
      'scene_hook',
      'shot_001',
      'loc_chamber'
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/location-reference'
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({ locationId: 'loc_chamber' });
  });

  it('updates the shot cast character sheet reference', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotCastCharacterSheetReference(
      'constantinople',
      'scene_hook',
      'shot_001',
      { castMemberId: 'cast_theodora', assetId: 'asset_sheet_001' }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/cast-character-sheet-reference'
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      castMemberId: 'cast_theodora',
      assetId: 'asset_sheet_001',
    });
  });

  it('updates the shot location environment sheet reference', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotLocationSheetReference(
      'constantinople',
      'scene_hook',
      'shot_001',
      { locationId: 'loc_chamber', assetId: 'asset_environment_001' }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/location-sheet-reference'
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      locationId: 'loc_chamber',
      assetId: 'asset_environment_001',
    });
  });

  it('updates the shot location view references', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotLocationViewReferences(
      'constantinople',
      'scene_hook',
      'shot_001',
      {
        locationId: 'loc_chamber',
        assetId: 'asset_environment_001',
        viewIds: ['front', 'right'],
      }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/location-view-references'
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      locationId: 'loc_chamber',
      assetId: 'asset_environment_001',
      viewIds: ['front', 'right'],
    });
  });

  it('updates the shot custom reference images on the current reference route', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotCustomReferenceImages(
      'constantinople',
      'scene_hook',
      'shot_001',
      ['input_texture', 'input_blade']
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/reference-images'
    );
    expect(String(url)).not.toContain('custom-reference-images');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      customReferenceInputIds: ['input_texture', 'input_blade'],
    });
  });

  it('parses structured API errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { code: 'PROJECT_DATA360', message: 'Boom.' },
      }),
    } as unknown as Response);
    await expect(
      readShotVideoTakeProduction('constantinople', 'scene_hook', ['shot_001'])
    ).rejects.toThrow('PROJECT_DATA360: Boom.');
  });
});
