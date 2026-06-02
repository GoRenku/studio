// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShotVideoTakeProductionGroup } from '@gorenku/studio-core/client';
import {
  clearShotVideoTakeInput,
  estimateShotVideoTakeProduction,
  previewShotVideoTakeProduction,
  readShotVideoTakeProduction,
  selectShotVideoTakeInput,
  updateShotVideoTakeProduction,
} from './studio-shot-video-takes-api';

const PRODUCTION_GROUP: ShotVideoTakeProductionGroup = {
  productionGroupId: 'scene_shot_video_take_group_001',
  shotIds: ['shot_001', 'shot_002'],
  videoTakeProduction: { intentId: 'multi-shot' },
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

  it('previews with the production group', async () => {
    vi.mocked(global.fetch).mockResolvedValue(okResponse({ preflight: {} }));
    await previewShotVideoTakeProduction(
      'constantinople',
      'scene_hook',
      PRODUCTION_GROUP
    );
    const [url, init] = lastCall();
    expect(String(url)).toContain('/video-take-production/preview');
    expect((init as RequestInit).method).toBe('POST');
    expect(lastBody()).toEqual({ productionGroup: PRODUCTION_GROUP });
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
