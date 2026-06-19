import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './screenplay.js';

const TAKE_ID = 'scene_shot_video_take_001';
const TAKE_PATH =
  `/constantinople/screenplay/scenes/scene_opening/takes/${TAKE_ID}`;
const PRODUCTION = { inputModeId: 'text-only' as const };

function sceneOwnershipError() {
  return createStructuredError({
    code: 'PROJECT_DATA423',
    message: 'Scene Shot Video Take does not belong to the requested scene.',
    issues: [],
    suggestion: 'Refresh the take context.',
  });
}

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
  it('lists and creates takes for a scene', async () => {
    const createSceneShotVideoTake = vi.fn(
      fakeProjectDataService().createSceneShotVideoTake
    );
    const app = mount({ createSceneShotVideoTake });

    const listResponse = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/takes'
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.takes).toEqual(expect.any(Array));

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
    expect(createSceneShotVideoTake).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        title: 'Manual video take',
      })
    );
  });

  it('GET returns context and model report from core', async () => {
    const app = mount();
    const response = await app.request(TAKE_PATH);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.context.purpose).toBe('shot.video-take');
    expect(body.context.target.takeId).toBe(TAKE_ID);
    expect(body.models.purpose).toBe('shot.video-take');
    expect(body.models.models.length).toBeGreaterThan(0);
  });

  it('DELETE delegates take deletion to core', async () => {
    const deleteSceneShotVideoTake = vi.fn(
      fakeProjectDataService().deleteSceneShotVideoTake
    );
    const app = mount({ deleteSceneShotVideoTake });
    const response = await app.request(TAKE_PATH, {
      method: 'DELETE',
    });
    expect(response.status).toBe(200);
    expect(deleteSceneShotVideoTake).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
      })
    );
    const body = await response.json();
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('pick PATCH delegates take pick state to core', async () => {
    const updateSceneShotVideoTakePick = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakePick
    );
    const app = mount({ updateSceneShotVideoTakePick });
    const response = await app.request(`${TAKE_PATH}/pick`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picked: true }),
    });
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakePick).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        picked: true,
      })
    );
    const body = await response.json();
    expect(body.take.picked).toBe(true);
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('GET edit-context returns the take-owned editing read model', async () => {
    const readSceneShotVideoTakeEditContext = vi.fn(
      fakeProjectDataService().readSceneShotVideoTakeEditContext
    );
    const app = mount({ readSceneShotVideoTakeEditContext });
    const response = await app.request(`${TAKE_PATH}/edit-context`);
    expect(response.status).toBe(200);
    expect(readSceneShotVideoTakeEditContext).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
      })
    );
    const body = await response.json();
    expect(body.editContext.take.takeId).toBe(TAKE_ID);
    expect(body.editContext.sourceShotList.id).toBe('shot_list_opening');
    expect(body.editContext.assetReadiness).toMatchObject({
      selectedInputCount: 0,
      readyInputCount: 0,
      missingInputCount: 0,
    });
  });

  it('GET edit-context rejects a take from another scene', async () => {
    const readSceneShotVideoTakeEditContext = vi.fn(async () => {
      throw sceneOwnershipError();
    });
    const app = mount({ readSceneShotVideoTakeEditContext });
    const response = await app.request(`${TAKE_PATH}/edit-context`);
    expect(response.status).toBe(400);
    expect(readSceneShotVideoTakeEditContext).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
      })
    );
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA423');
  });

  it('PATCH rejects unknown top-level fields', async () => {
    const app = mount();
    const response = await app.request(TAKE_PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION, extra: true }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('STUDIO_SERVER341');
  });

  it('PATCH delegates production updates to core', async () => {
    const updateSceneShotVideoTakeProduction = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakeProduction
    );
    const app = mount({ updateSceneShotVideoTakeProduction });
    const response = await app.request(TAKE_PATH, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION }),
    });
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        production: PRODUCTION,
      })
    );
    const body = await response.json();
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('shots PATCH delegates the replacement shot ids to core', async () => {
    const updateSceneShotVideoTakeShots = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakeShots
    );
    const app = mount({ updateSceneShotVideoTakeShots });
    const response = await app.request(`${TAKE_PATH}/shots`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shotIds: ['shot_001', 'shot_002'] }),
    });
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeShots).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        shotIds: ['shot_001', 'shot_002'],
      })
    );
  });

  it('shot design PATCH delegates take-owned shot design to core', async () => {
    const updateSceneShotVideoTakeShotDesign = vi.fn(
      fakeProjectDataService().updateSceneShotVideoTakeShotDesign
    );
    const app = mount({ updateSceneShotVideoTakeShotDesign });
    const response = await app.request(
      `${TAKE_PATH}/shots/shot_001/design`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotDesign: { shotSize: 'close-up' } }),
      }
    );
    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeShotDesign).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        shotId: 'shot_001',
        shotDesign: { shotSize: 'close-up' },
      })
    );
  });

  it('plan accepts inputPolicy and delegates to core', async () => {
    const readShotVideoTakeProductionPlan = vi.fn(
      fakeProjectDataService().readShotVideoTakeProductionPlan
    );
    const app = mount({ readShotVideoTakeProductionPlan });
    const response = await app.request(`${TAKE_PATH}/plan`, {
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
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
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

  it('plan rejects invalid inputPolicy through shared core validation', async () => {
    const readShotVideoTakeProductionPlan = vi.fn(
      fakeProjectDataService().readShotVideoTakeProductionPlan
    );
    const app = mount({ readShotVideoTakeProductionPlan });
    const response = await app.request(`${TAKE_PATH}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        production: PRODUCTION,
        inputPolicy: {
          defaultMode: 'reuse-ish',
        },
      }),
    });
    expect(response.status).toBe(400);
    expect(readShotVideoTakeProductionPlan).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA434');
  });

  it('estimate delegates to core and returns an estimate report', async () => {
    const estimateShotVideoTakeProduction = vi.fn(
      fakeProjectDataService().estimateShotVideoTakeProduction
    );
    const app = mount({ estimateShotVideoTakeProduction });
    const response = await app.request(`${TAKE_PATH}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production: PRODUCTION }),
    });
    expect(response.status).toBe(200);
    expect(estimateShotVideoTakeProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
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

    const selectResponse = await app.request(`${TAKE_PATH}/inputs/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputId: 'input_001' }),
    });
    expect(selectResponse.status).toBe(200);
    expect(selectShotVideoTakeInput).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        inputId: 'input_001',
      })
    );

    const clearResponse = await app.request(`${TAKE_PATH}/inputs/clear`, {
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
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        kind: 'first-frame',
        subjectKind: 'shot',
        subjectId: 'shot_001',
      })
    );

    const deleteResponse = await app.request(
      `${TAKE_PATH}/inputs/input_001`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(deleteResponse.status).toBe(200);
    expect(deleteShotVideoTakeInput).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        inputId: 'input_001',
      })
    );
  });

  for (const routeCase of [
    {
      name: 'production update',
      path: TAKE_PATH,
      request: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production: PRODUCTION }),
      },
      override: (handler: () => Promise<never>) => ({
        updateSceneShotVideoTakeProduction: handler,
      }),
    },
    {
      name: 'shot membership update',
      path: `${TAKE_PATH}/shots`,
      request: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIds: ['shot_001'] }),
      },
      override: (handler: () => Promise<never>) => ({
        updateSceneShotVideoTakeShots: handler,
      }),
    },
    {
      name: 'shot design update',
      path: `${TAKE_PATH}/shots/shot_001/design`,
      request: {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotDesign: { shotSize: 'close-up' } }),
      },
      override: (handler: () => Promise<never>) => ({
        updateSceneShotVideoTakeShotDesign: handler,
      }),
    },
    {
      name: 'production plan',
      path: `${TAKE_PATH}/plan`,
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production: PRODUCTION }),
      },
      override: (handler: () => Promise<never>) => ({
        readShotVideoTakeProductionPlan: handler,
      }),
    },
    {
      name: 'production estimate',
      path: `${TAKE_PATH}/estimate`,
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production: PRODUCTION }),
      },
      override: (handler: () => Promise<never>) => ({
        estimateShotVideoTakeProduction: handler,
      }),
    },
    {
      name: 'input selection',
      path: `${TAKE_PATH}/inputs/select`,
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputId: 'input_001' }),
      },
      override: (handler: () => Promise<never>) => ({
        selectShotVideoTakeInput: handler,
      }),
    },
    {
      name: 'input clear',
      path: `${TAKE_PATH}/inputs/clear`,
      request: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'first-frame',
          subjectKind: 'shot',
          subjectId: 'shot_001',
        }),
      },
      override: (handler: () => Promise<never>) => ({
        clearShotVideoTakeInputSelection: handler,
      }),
    },
    {
      name: 'input delete',
      path: `${TAKE_PATH}/inputs/input_001`,
      request: {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      override: (handler: () => Promise<never>) => ({
        deleteShotVideoTakeInput: handler,
      }),
    },
    {
      name: 'input file serving',
      path: `${TAKE_PATH}/inputs/input_001/files/file_001`,
      request: { method: 'GET' },
      override: (handler: () => Promise<never>) => ({
        resolveShotVideoTakeInputFile: handler,
      }),
    },
  ]) {
    it(`returns core scene ownership errors for ${routeCase.name}`, async () => {
      const handler = vi.fn(async () => {
        throw sceneOwnershipError();
      });
      const app = mount(routeCase.override(handler));

      const response = await app.request(routeCase.path, routeCase.request);

      expect(response.status).toBe(400);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'constantinople',
          sceneId: 'scene_opening',
          takeId: TAKE_ID,
        })
      );
      const body = await response.json();
      expect(body.error.code).toBe('PROJECT_DATA423');
    });
  }

  it('reference inclusion PATCH delegates take-owned shot state updates to core', async () => {
    const fakeProjectData = fakeProjectDataService();
    const updateSceneShotVideoTakeReferenceInclusion = vi.fn(
      fakeProjectData.updateSceneShotVideoTakeReferenceInclusion
    );
    const app = mount({
      updateSceneShotVideoTakeReferenceInclusion,
    });

    const response = await app.request(
      `${TAKE_PATH}/reference-inclusions`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependencyId: 'reference-image:shot:shot_001',
          inclusion: 'exclude',
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeReferenceInclusion).toHaveBeenCalledOnce();
    expect(updateSceneShotVideoTakeReferenceInclusion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        dependencyId: 'reference-image:shot:shot_001',
        inclusion: 'exclude',
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      context: {
        target: {
          takeId: TAKE_ID,
        },
        take: {
          state: {
            referenceSelections: {
              dependencyInclusions: {
                'reference-image:shot:shot_001': 'exclude',
              },
            },
          },
        },
      },
    });
  });

  it('reference inclusion PATCH deletes take-owned dependency overrides', async () => {
    const fakeProjectData = fakeProjectDataService();
    const updateSceneShotVideoTakeReferenceInclusion = vi.fn(
      fakeProjectData.updateSceneShotVideoTakeReferenceInclusion
    );
    const app = mount({
      updateSceneShotVideoTakeReferenceInclusion,
    });

    const response = await app.request(
      `${TAKE_PATH}/reference-inclusions`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dependencyId: 'reference-image:shot:shot_001',
          inclusion: null,
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(updateSceneShotVideoTakeReferenceInclusion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'constantinople',
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
        dependencyId: 'reference-image:shot:shot_001',
        inclusion: null,
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      context: {
        take: {
          state: {
            referenceSelections: {
              dependencyInclusions: {},
            },
          },
        },
      },
    });
  });

  it('rejects group reference inclusion when the URL scene does not own the take', async () => {
    const updateSceneShotVideoTakeReferenceInclusion = vi.fn(async () => {
      throw sceneOwnershipError();
    });
    const app = mount({
      updateSceneShotVideoTakeReferenceInclusion,
    });

    const response = await app.request(
      `${TAKE_PATH}/reference-inclusions`,
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
    expect(updateSceneShotVideoTakeReferenceInclusion).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: 'scene_opening',
        takeId: TAKE_ID,
      })
    );
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA423');
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
    const response = await app.request(TAKE_PATH);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA360');
    expect(body.error.suggestion).toBe('Fix it.');
  });
});
