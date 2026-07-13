// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShotVideoTake,
  discardShotVideoTake,
  estimateShotVideoTakeGeneration,
  listShotVideoTakes,
  readShotVideoTakeWorkspace,
  replaceShotVideoTakeShots,
  setShotVideoTakeDirection,
  setShotVideoTakeGenerationReference,
  setShotVideoTakeGenerationSpec,
  setShotVideoTakePicked,
  setShotVideoTakeStructure,
} from './studio-shot-video-takes-api';

const ROOT =
  '/studio-api/projects/constantinople/screenplay/scenes/scene_test/takes';
const TAKE = `${ROOT}/take_test`;
const SETUP = {
  inputModeId: 'text-only' as const,
  modelChoice: 'fal-ai/bytedance/seedance-2.0',
  parameterValues: { duration: 5 },
};

describe('studio Shot Video Take API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        takes: [],
        overview: {},
        workspace: { take: { takeId: 'take_test' } },
        resourceKeys: [],
        recovery: {},
        take: {},
        estimate: { valid: true, estimate: { estimatedCostUsd: 0.42 } },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists, reads, and creates through the focused workspace endpoints', async () => {
    await listShotVideoTakes('constantinople', 'scene_test');
    expect(global.fetch).toHaveBeenNthCalledWith(1, ROOT);

    await readShotVideoTakeWorkspace(
      'constantinople',
      'scene_test',
      'take_test'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, TAKE);

    await createShotVideoTake('constantinople', 'scene_test', {
      shotListId: 'shot_list_test',
      shotIds: ['shot_001'],
      title: 'Take 1',
    });
    expect(global.fetch).toHaveBeenNthCalledWith(3, ROOT, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        shotListId: 'shot_list_test',
        shotIds: ['shot_001'],
        title: 'Take 1',
      }),
    });
  });

  it('persists generation setup and estimates the same exact request', async () => {
    await setShotVideoTakeGenerationSpec(
      'constantinople',
      'scene_test',
      'take_test',
      SETUP
    );
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${TAKE}/generation`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ setup: SETUP }),
    });

    await estimateShotVideoTakeGeneration(
      'constantinople',
      'scene_test',
      'take_test',
      SETUP
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${TAKE}/estimate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ setup: SETUP }),
    });
  });

  it('keeps multi-cut workspace reads and mutations focused on the selected Shot', async () => {
    await readShotVideoTakeWorkspace(
      'constantinople',
      'scene_test',
      'take_test',
      'shot_002'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `${TAKE}?selectedShotId=shot_002`
    );

    await setShotVideoTakeGenerationSpec(
      'constantinople',
      'scene_test',
      'take_test',
      SETUP,
      'shot_002'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${TAKE}/generation`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ setup: SETUP, selectedShotId: 'shot_002' }),
    });

    await setShotVideoTakeGenerationReference(
      'constantinople',
      'scene_test',
      'take_test',
      {
        selectionId: 'candidate:shot_002:first-frame:file_002',
        included: true,
        selectedShotId: 'shot_002',
      }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      `${TAKE}/generation/references`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          selectionId: 'candidate:shot_002:first-frame:file_002',
          included: true,
          selectedShotId: 'shot_002',
        }),
      }
    );
  });

  it('updates exact generic reference selections', async () => {
    await setShotVideoTakeGenerationReference(
      'constantinople',
      'scene_test',
      'take_test',
      { selectionId: 'candidate:shared:first-frame:file_001', included: true }
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${TAKE}/generation/references`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          selectionId: 'candidate:shared:first-frame:file_001',
          included: true,
        }),
      }
    );
  });

  it('persists continuous and per-Shot direction without generic state patches', async () => {
    await setShotVideoTakeDirection(
      'constantinople',
      'scene_test',
      'take_test',
      { composition: { shotSize: 'close-up' } }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${TAKE}/direction`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        direction: { composition: { shotSize: 'close-up' } },
      }),
    });

    await setShotVideoTakeDirection(
      'constantinople',
      'scene_test',
      'take_test',
      { motion: { movement: 'static' } },
      'shot_001'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${TAKE}/shots/shot_001/direction`,
      {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ direction: { motion: { movement: 'static' } } }),
      }
    );
  });

  it('updates structure and ordered Shot membership', async () => {
    await setShotVideoTakeStructure(
      'constantinople',
      'scene_test',
      'take_test',
      'continuous',
      'shot_001'
    );
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${TAKE}/structure`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ mode: 'continuous', sourceShotId: 'shot_001' }),
    });

    await replaceShotVideoTakeShots(
      'constantinople',
      'scene_test',
      'take_test',
      ['shot_001', 'shot_002']
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${TAKE}/shots`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ shotIds: ['shot_001', 'shot_002'] }),
    });
  });

  it('delegates pick and recoverable discard', async () => {
    await setShotVideoTakePicked(
      'constantinople',
      'scene_test',
      'take_test',
      true
    );
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${TAKE}/pick`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ picked: true }),
    });

    await discardShotVideoTake('constantinople', 'scene_test', 'take_test');
    expect(global.fetch).toHaveBeenNthCalledWith(2, TAKE, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({}),
    });
  });

  it('reads structured API errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { code: 'CORE_SHOT_VIDEO_TAKE_TEST', message: 'Mutation failed.' },
      }),
    } as Response);

    await expect(
      readShotVideoTakeWorkspace('constantinople', 'scene_test', 'take_test')
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_VIDEO_TAKE_TEST',
      message: 'CORE_SHOT_VIDEO_TAKE_TEST: Mutation failed.',
    });
  });
});

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Renku-Studio-Token': 'studio-token-test',
  };
}
