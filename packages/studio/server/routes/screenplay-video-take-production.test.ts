import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './screenplay.js';

const TAKE_GENERATION_ID = 'scene_shot_video_take_generation_001';
const TAKE_GENERATION_PATH =
  `/constantinople/screenplay/scenes/scene_opening/take-generations/${TAKE_GENERATION_ID}`;
const PRODUCTION = { inputModeId: 'text-only' as const };

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

describe('shot video take generation routes', () => {
  it('lists and creates take generations for a scene', async () => {
    const createSceneShotVideoTakeGeneration = vi.fn(
      fakeProjectDataService().createSceneShotVideoTakeGeneration
    );
    const app = mount({ createSceneShotVideoTakeGeneration });

    const listResponse = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/take-generations'
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.takeGenerations).toEqual(expect.any(Array));

    const createResponse = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/take-generations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotListId: 'shot_list_opening',
          shotIds: ['shot_001'],
          title: 'Manual take generation',
        }),
      }
    );
    expect(createResponse.status).toBe(200);
    expect(createSceneShotVideoTakeGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        title: 'Manual take generation',
      })
    );
  });

  it('GET returns context and model report from core', async () => {
    const app = mount();
    const response = await app.request(TAKE_GENERATION_PATH);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.context.purpose).toBe('shot.video-take');
    expect(body.context.target.takeGenerationId).toBe(TAKE_GENERATION_ID);
    expect(body.models.purpose).toBe('shot.video-take');
    expect(body.models.models.length).toBeGreaterThan(0);
  });

  it('PATCH rejects unknown top-level fields', async () => {
    const app = mount();
    const response = await app.request(TAKE_GENERATION_PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION, extra: true }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('STUDIO_SERVER341');
  });

  it('PATCH delegates production updates to core', async () => {
    const updateSceneShotVideoTakeGenerationProduction = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakeGenerationProduction
    );
    const app = mount({ updateSceneShotVideoTakeGenerationProduction });
    const response = await app.request(TAKE_GENERATION_PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION }),
    });
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeGenerationProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        takeGenerationId: TAKE_GENERATION_ID,
        production: PRODUCTION,
      })
    );
    const body = await response.json();
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('shots PATCH delegates the replacement shot ids to core', async () => {
    const updateSceneShotVideoTakeGenerationShots = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakeGenerationShots
    );
    const app = mount({ updateSceneShotVideoTakeGenerationShots });
    const response = await app.request(`${TAKE_GENERATION_PATH}/shots`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shotIds: ['shot_001', 'shot_002'] }),
    });
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeGenerationShots).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        takeGenerationId: TAKE_GENERATION_ID,
        shotIds: ['shot_001', 'shot_002'],
      })
    );
  });

  it('plan accepts inputPolicy and delegates to core', async () => {
    const readShotVideoTakeProductionPlan = vi.fn(
      fakeProjectDataService().readShotVideoTakeProductionPlan
    );
    const app = mount({ readShotVideoTakeProductionPlan });
    const response = await app.request(`${TAKE_GENERATION_PATH}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        production: PRODUCTION,
        inputPolicy: {
          defaultMode: 'auto',
          slotModes: { 'first-frame': 'regenerate' },
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(readShotVideoTakeProductionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        takeGenerationId: TAKE_GENERATION_ID,
        production: PRODUCTION,
        inputPolicy: {
          defaultMode: 'auto',
          slotModes: { 'first-frame': 'regenerate' },
        },
      })
    );
    const body = await response.json();
    expect(body.report.plan.planId).toBe('shot_video_take_plan_fake');
  });

  it('estimate delegates to core and returns an estimate report', async () => {
    const estimateShotVideoTakeProduction = vi.fn(
      fakeProjectDataService().estimateShotVideoTakeProduction
    );
    const app = mount({ estimateShotVideoTakeProduction });
    const response = await app.request(`${TAKE_GENERATION_PATH}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION }),
    });
    expect(response.status).toBe(200);
    expect(estimateShotVideoTakeProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        takeGenerationId: TAKE_GENERATION_ID,
        production: PRODUCTION,
      })
    );
    const body = await response.json();
    expect(body.estimate.estimate.estimatedCostUsd).toBe(0.42);
  });

  it('input mutations delegate to core and return resource keys', async () => {
    const selectShotVideoTakeInput = vi.fn(
      fakeProjectDataService().selectShotVideoTakeInput
    );
    const clearShotVideoTakeInputSelection = vi.fn(
      fakeProjectDataService().clearShotVideoTakeInputSelection
    );
    const deleteShotVideoTakeInput = vi.fn(
      fakeProjectDataService().deleteShotVideoTakeInput
    );
    const app = mount({
      selectShotVideoTakeInput,
      clearShotVideoTakeInputSelection,
      deleteShotVideoTakeInput,
    });

    const selectResponse = await app.request(`${TAKE_GENERATION_PATH}/inputs/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputId: 'input_001' }),
    });
    expect(selectResponse.status).toBe(200);
    expect(selectShotVideoTakeInput).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        takeGenerationId: TAKE_GENERATION_ID,
        inputId: 'input_001',
      })
    );

    const clearResponse = await app.request(`${TAKE_GENERATION_PATH}/inputs/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'first-frame',
        subjectKind: 'shot',
        subjectId: 'shot_001',
      }),
    });
    expect(clearResponse.status).toBe(200);
    expect(clearShotVideoTakeInputSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        takeGenerationId: TAKE_GENERATION_ID,
        kind: 'first-frame',
        subjectKind: 'shot',
        subjectId: 'shot_001',
      })
    );

    const deleteResponse = await app.request(
      `${TAKE_GENERATION_PATH}/inputs/input_001`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(deleteResponse.status).toBe(200);
    expect(deleteShotVideoTakeInput).toHaveBeenCalledWith(
      expect.objectContaining({
        takeGenerationId: TAKE_GENERATION_ID,
        inputId: 'input_001',
      })
    );
  });



  it('rejects group reference inclusion when the URL scene does not own the take generation', async () => {
    const updateSceneShotGroupReferenceInclusion = vi.fn(
      fakeProjectDataService().updateSceneShotGroupReferenceInclusion
    );
    const app = mount({
      updateSceneShotGroupReferenceInclusion,
      buildShotVideoTakeContext: async (input) => ({
        ...(await fakeProjectDataService().buildShotVideoTakeContext(input)),
        scene: {
          id: 'scene_from_take_generation',
          title: 'Different Scene',
          setting: { locationIds: [] },
          storyFunction: [],
        },
      }),
    });

    const response = await app.request(
      `${TAKE_GENERATION_PATH}/reference-inclusions`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependencyId: 'reference-image:shot:shot_001',
          inclusion: 'exclude',
        }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER350' },
    });
    expect(updateSceneShotGroupReferenceInclusion).not.toHaveBeenCalled();
  });

  it('serializes structured errors from core', async () => {
    const app = mount({
      buildShotVideoTakeContext: async () => {
        throw createStructuredError({
          code: 'PROJECT_DATA360',
          message: 'Boom.',
          issues: [],
          suggestion: 'Fix it.',
        });
      },
    });
    const response = await app.request(TAKE_GENERATION_PATH);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA360');
    expect(body.error.suggestion).toBe('Fix it.');
  });
});
