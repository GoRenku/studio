// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneShotVideoTakeProductionState } from '@gorenku/studio-core/client';
import {
  clearShotVideoTakeInput,
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readSceneShotVideoTakeEditContext,
  readShotVideoTakeProduction,
  selectShotVideoTakeInput,
  updateShotGroupReferenceInclusion,
  updateTakeCharacterSheetSelection,
  updateTakeDialogueAudioSelection,
  updateTakeLocationSheetSelection,
  updateTakeLocationViewSelection,
  updateShotVideoTakeProduction,
  updateSceneShotVideoTakeShotDesign,
} from './studio-shot-video-takes-api';

const TAKE_ID = 'scene_shot_video_take_001';
const PRODUCTION: SceneShotVideoTakeProductionState = { inputModeId: 'reference' };

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

  it('autosaves take-owned shot design', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateSceneShotVideoTakeShotDesign(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      'shot_001',
      { composition: { shotSize: 'close-up' } }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/takes/${TAKE_ID}/shots/shot_001/design`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      shotDesign: { composition: { shotSize: 'close-up' } },
    });
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
    const production: SceneShotVideoTakeProductionState = {
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

  it('updates the take character sheet selection', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateTakeCharacterSheetSelection(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      { castMemberId: 'cast_theodora', assetId: 'asset_sheet_001' }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/screenplay/scenes/scene_hook/takes/${TAKE_ID}/reference-selections/character-sheets`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      castMemberId: 'cast_theodora',
      assetId: 'asset_sheet_001',
    });
  });

  it('updates the take location environment sheet selection', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateTakeLocationSheetSelection(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      { locationId: 'loc_chamber', assetId: 'asset_environment_001' }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/screenplay/scenes/scene_hook/takes/${TAKE_ID}/reference-selections/location-sheets`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      locationId: 'loc_chamber',
      assetId: 'asset_environment_001',
    });
  });

  it('updates the take location view selection', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateTakeLocationViewSelection(
      'constantinople',
      'scene_hook',
      TAKE_ID,
      {
        locationId: 'loc_chamber',
        assetId: 'asset_environment_001',
        viewIds: ['front', 'right'],
      }
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/screenplay/scenes/scene_hook/takes/${TAKE_ID}/reference-selections/location-views`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      locationId: 'loc_chamber',
      assetId: 'asset_environment_001',
      viewIds: ['front', 'right'],
    });
  });

  it('updates the take dialogue audio selection', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      okResponse({ context: {}, resourceKeys: [] })
    );
    await updateTakeDialogueAudioSelection('constantinople', 'scene_hook', TAKE_ID, {
      dialogueId: 'dialogue_001',
      takeId: 'audio_take_001',
    });
    const [url, init] = lastCall();
    expect(String(url)).toContain(
      `/screenplay/scenes/scene_hook/takes/${TAKE_ID}/reference-selections/dialogue-audio`
    );
    expect((init as RequestInit).method).toBe('PATCH');
    expect(lastBody()).toEqual({
      dialogueId: 'dialogue_001',
      takeId: 'audio_take_001',
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
