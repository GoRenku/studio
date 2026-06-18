// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeGenerationProduction } from '@gorenku/studio-core/client';
import {
  clearShotVideoTakeInput,
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readSceneShotVideoTakeEditContext,
  readShotVideoTakeProduction,
  selectShotVideoTakeInput,
  updateShotCastCharacterSheetReference,
  updateShotCustomReferenceImages,
  updateShotLocationReference,
  updateShotLocationSheetReference,
  updateShotLocationViewReferences,
  updateShotReferenceInclusion,
  updateShotGroupReferenceInclusion,
  updateShotVideoTakeProduction,
  updateSceneShotVideoTakeShotSpecs,
} from './studio-shot-video-takes-api';

const TAKE_ID = 'scene_shot_video_take_001';
const PRODUCTION: ShotVideoTakeGenerationProduction = { inputModeId: 'reference' };

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

  it('reads production for a take', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, models: {} })
    );
    await readShotVideoTakeProduction('constantinople', 'scene_hook', TAKE_ID);
    const [url] = lastCall();
    expect(String(url)).toBe(
      `/studio-api/projects/constantinople/screenplay/scenes/scene_hook/takes/${TAKE_ID}`
    );
  });

  it('autosaves take production', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      PRODUCTION
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(`/takes/${TAKE_ID}`);
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({ production: PRODUCTION });
  });

  it('reads the take edit context', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ editContext: {} }));
    await readSceneShotVideoTakeEditContext(
      'constantinople',
      'scene_hook',
      TAKE_ID
    );
    const [url, init] = lastCall();
    expect(String(url)).toBe(
      `/studio-api/projects/constantinople/screenplay/scenes/scene_hook/takes/${TAKE_ID}/edit-context`
    );
    expect(init).toBeUndefined();
  });

  it('autosaves take-owned shot specs', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateSceneShotVideoTakeShotSpecs(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      'shot_001',
      { shotSize: 'close-up' }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/takes/${TAKE_ID}/shots/shot_001/specs`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({ shotSpecs: { shotSize: 'close-up' } });
  });

  it('reads the inline production plan report with production', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ report: {} }));
    await planShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      PRODUCTION
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(`/takes/${TAKE_ID}/plan`);
    expect((init as RequestInit).method).toBe('POST');
    expect(lastBody()).toEqual({
      production: PRODUCTION,
      inputPolicy: { defaultMode: 'auto' },
    });
  });

  it('estimates with production', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ estimate: {} }));
    await estimateShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      PRODUCTION
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(`/takes/${TAKE_ID}/estimate`);
    expect((init as RequestInit).method).toBe('POST');
    expect(lastBody()).toEqual({ production: PRODUCTION });
  });

  it.each([
    'fal-ai/kling-video/v3/standard',
    'fal-ai/kling-video/v3/pro',
    'fal-ai/kling-video/o3/standard',
    'fal-ai/kling-video/o3/pro',
  ] as const)('estimates the %s production without remapping the model', async (modelChoice) => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ estimate: {} }));
    const production: ShotVideoTakeGenerationProduction = {
      inputModeId: 'reference',
      modelChoice,
      parameterValues: { duration: '5' },
    };
    await estimateShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      production
    );
    expect(lastBody()).toEqual({ production });
  });

  it('selects a reusable input for a take', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await selectShotVideoTakeInput(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      'input_001'
    );
    const [url] = lastCall();
    expect(String(url)).toContain(`/takes/${TAKE_ID}/inputs/select`);
    expect(lastBody()).toEqual({ inputId: 'input_001' });
  });

  it('clears an input with kind and optional subject', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await clearShotVideoTakeInput('constantinople', 'scene_hook', TAKE_ID, {
      kind: 'first-frame',
      subjectKind: 'shot',
      subjectId: 'shot_001',
    });
    const [url] = lastCall();
    expect(String(url)).toContain(`/takes/${TAKE_ID}/inputs/clear`);
    expect(lastBody()).toEqual({
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

  it('updates a shot reference inclusion override', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ resource: {}, resourceKeys: [] })
    );
    await updateShotReferenceInclusion(
      'constantinople',
      'scene_hook',
      'shot_001',
      {
        dependencyId: 'reference-image:shot:shot_001',
        inclusion: 'exclude',
      }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      '/screenplay/scenes/scene_hook/shots/shot_001/reference-inclusions'
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      dependencyId: 'reference-image:shot:shot_001',
      inclusion: 'exclude',
    });
  });

  it('updates a take reference inclusion override', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateShotGroupReferenceInclusion(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      {
        dependencyId: 'reference-image:shot:shot_001',
        inclusion: 'exclude',
      }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/screenplay/scenes/scene_hook/takes/${TAKE_ID}/reference-inclusions`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      dependencyId: 'reference-image:shot:shot_001',
      inclusion: 'exclude',
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
      readShotVideoTakeProduction(
        'constantinople',
        'scene_hook',
        TAKE_ID
      )
    ).rejects.toThrow('PROJECT_DATA360: Boom.');
  });
});
