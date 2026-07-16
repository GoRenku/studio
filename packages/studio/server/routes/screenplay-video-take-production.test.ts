import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './screenplay.js';

const TAKE_ID = 'scene_shot_video_take_001';
const TAKE_PATH =
  `/constantinople/screenplay/scenes/scene_opening/takes/${TAKE_ID}`;
const SETUP = {
  inputModeId: 'text-only' as const,
  modelChoice: 'fal-ai/bytedance/seedance-2.0',
  parameterValues: { duration: 5 },
};

function mount(overrides: Partial<ReturnType<typeof fakeProjectDataService>> = {}) {
  return new Hono().route(
    '/:projectName',
    createScreenplayRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('shot video take routes', () => {
  it('lists and creates focused Shot Video Takes', async () => {
    const createShotVideoTake = vi.fn(
      fakeProjectDataService().createShotVideoTake
    );
    const app = mount({ createShotVideoTake });

    const listResponse = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/takes'
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      takes: [{ take: { sceneId: 'scene_opening' } }],
    });

    const createResponse = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/takes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotListId: 'shot_list_opening',
          shotIds: ['shot_001'],
          title: 'Manual video take',
        }),
      }
    );
    expect(createResponse.status).toBe(200);
    await expect(createResponse.json()).resolves.toMatchObject({
      overview: {
        take: {
          sceneId: 'scene_opening',
          shotIds: ['shot_001'],
          title: 'Manual video take',
        },
      },
    });
    expect(createShotVideoTake).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
      })
    );
  });

  it('reads the current workspace and generation session', async () => {
    const readShotVideoTakeWorkspace = vi.fn(
      fakeProjectDataService().readShotVideoTakeWorkspace
    );
    const app = mount({ readShotVideoTakeWorkspace });
    const response = await app.request(TAKE_PATH);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      workspace: {
        take: { takeId: TAKE_ID, state: { version: 3 } },
        generation: {
          context: { purpose: 'shot.video-take' },
          setup: { inputModeId: 'text-only' },
          models: [{ label: 'Seedance 2.0' }],
        },
      },
    });
    expect(readShotVideoTakeWorkspace).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      takeId: TAKE_ID,
    });
  });

  it('passes the selected Shot to Core as workspace projection context', async () => {
    const readShotVideoTakeWorkspace = vi.fn(
      fakeProjectDataService().readShotVideoTakeWorkspace
    );
    const app = mount({ readShotVideoTakeWorkspace });
    const response = await app.request(`${TAKE_PATH}?selectedShotId=shot_002`);

    expect(response.status).toBe(200);
    expect(readShotVideoTakeWorkspace).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      takeId: TAKE_ID,
      selectedShotId: 'shot_002',
    });
  });

  it('delegates discard and pick mutations to focused Core commands', async () => {
    const discardShotVideoTake = vi.fn(
      fakeProjectDataService().discardShotVideoTake
    );
    const setShotVideoTakePicked = vi.fn(
      fakeProjectDataService().setShotVideoTakePicked
    );
    const app = mount({ discardShotVideoTake, setShotVideoTakePicked });

    const pickResponse = await app.request(`${TAKE_PATH}/pick`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picked: true }),
    });
    expect(pickResponse.status).toBe(200);
    expect(setShotVideoTakePicked).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      takeId: TAKE_ID,
      picked: true,
    });

    const discardResponse = await app.request(TAKE_PATH, { method: 'DELETE' });
    expect(discardResponse.status).toBe(200);
    expect(discardShotVideoTake).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      takeId: TAKE_ID,
    });
  });

  it.each([
    {
      suffix: '/shots',
      body: { shotIds: ['shot_001', 'shot_002'] },
      method: 'replaceShotVideoTakeShots' as const,
      expected: { shotIds: ['shot_001', 'shot_002'] },
    },
    {
      suffix: '/direction',
      body: { direction: { composition: { shotSize: 'close-up' } } },
      method: 'setShotVideoTakeDirection' as const,
      expected: { direction: { composition: { shotSize: 'close-up' } } },
    },
    {
      suffix: '/shots/shot_001/direction',
      body: { direction: { motion: { movement: 'static' } } },
      method: 'setShotVideoTakeDirection' as const,
      expected: {
        shotId: 'shot_001',
        direction: { motion: { movement: 'static' } },
      },
    },
    {
      suffix: '/structure',
      body: { mode: 'multi-cut' },
      method: 'setShotVideoTakeStructure' as const,
      expected: { mode: 'multi-cut' },
    },
    {
      suffix: '/generation',
      body: { setup: SETUP },
      method: 'setShotVideoTakeGenerationSpec' as const,
      expected: { setup: SETUP },
    },
    {
      suffix: '/generation/references',
      body: { selection: { placement: { kind: 'slot', sectionId: 'take-media', slotId: 'first-frame' }, reference: null } },
      method: 'setShotVideoTakeGenerationReference' as const,
      expected: {
        selection: { placement: { kind: 'slot', sectionId: 'take-media', slotId: 'first-frame' }, reference: null },
      },
    },
    {
      suffix: '/generation/generic-references',
      body: {
        references: [{
          kind: 'asset-file',
          assetId: 'asset_ambience',
          assetFileId: 'file_ambience',
        }],
      },
      method: 'setShotVideoTakeGenerationGenericReferences' as const,
      expected: {
        references: [{
          kind: 'asset-file',
          assetId: 'asset_ambience',
          assetFileId: 'file_ambience',
        }],
      },
    },
  ])('delegates $suffix through the current workspace contract', async ({
    suffix,
    body,
    method,
    expected,
  }) => {
    const handler = vi.fn(fakeProjectDataService()[method]);
    const app = mount({ [method]: handler });
    const response = await app.request(`${TAKE_PATH}${suffix}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        ...expected,
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      workspace: { take: { takeId: TAKE_ID } },
    });
  });

  it('estimates the selected model from pricing inputs', async () => {
    const estimateShotVideoTakeGeneration = vi.fn(
      fakeProjectDataService().estimateShotVideoTakeGeneration
    );
    const app = mount({ estimateShotVideoTakeGeneration });
    const response = await app.request(`${TAKE_PATH}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup: SETUP }),
    });

    expect(response.status).toBe(200);
    expect(estimateShotVideoTakeGeneration).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      takeId: TAKE_ID,
      setup: SETUP,
    });
    await expect(response.json()).resolves.toMatchObject({
      estimate: {
        valid: true,
        estimate: { estimatedCostUsd: 0.42 },
      },
    });
  });

  it('rejects malformed generation setup before calling Core', async () => {
    const setShotVideoTakeGenerationSpec = vi.fn(
      fakeProjectDataService().setShotVideoTakeGenerationSpec
    );
    const app = mount({ setShotVideoTakeGenerationSpec });
    const response = await app.request(`${TAKE_PATH}/generation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: { inputModeId: 'invented', parameterValues: {} },
      }),
    });

    expect(response.status).toBe(400);
    expect(setShotVideoTakeGenerationSpec).not.toHaveBeenCalled();
  });

  it('serializes structured ownership errors from Core', async () => {
    const readShotVideoTakeWorkspace = vi.fn(async () => {
      throw createStructuredError({
        code: 'CORE_SHOT_VIDEO_TAKE_SCENE_MISMATCH',
        message: 'The requested Scene does not own this Shot Video Take.',
      });
    });
    const app = mount({ readShotVideoTakeWorkspace });
    const response = await app.request(TAKE_PATH);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CORE_SHOT_VIDEO_TAKE_SCENE_MISMATCH',
        message: 'The requested Scene does not own this Shot Video Take.',
      },
    });
  });
});
