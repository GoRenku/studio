import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './screenplay.js';

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

const PRODUCTION_GROUP = {
  productionGroupId: 'scene_shot_video_take_group_001',
  shotIds: ['shot_001'],
  videoTakeProduction: { intentId: 'text-only' as const },
};

describe('shot video take production routes', () => {
  it('GET requires shotIds', async () => {
    const app = mount();
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production'
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('STUDIO_SERVER344');
  });

  it('GET returns context and model report from core', async () => {
    const app = mount();
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production?shotIds=shot_001,shot_002'
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.context.purpose).toBe('shot.video-take');
    expect(body.context.target.shotIds).toEqual(['shot_001', 'shot_002']);
    expect(body.models.purpose).toBe('shot.video-take');
    expect(body.models.models.length).toBeGreaterThan(0);
  });

  it('PATCH rejects unknown top-level fields', async () => {
    const app = mount();
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionGroup: PRODUCTION_GROUP, extra: true }),
      }
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('STUDIO_SERVER341');
  });

  it('PATCH delegates to core and returns the refreshed resource with keys', async () => {
    const updateShotVideoTakeProductionGroup = vi.fn(
      fakeProjectDataService().updateShotVideoTakeProductionGroup
    );
    const app = mount({ updateShotVideoTakeProductionGroup });
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionGroup: PRODUCTION_GROUP }),
      }
    );
    expect(response.status).toBe(200);
    expect(updateShotVideoTakeProductionGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        productionGroupId: 'scene_shot_video_take_group_001',
        production: { intentId: 'text-only' },
      })
    );
    const body = await response.json();
    expect(body.resource.activeShotListId).toBe('shot_list_opening');
    expect(body.resourceKeys).toContain(
      'scene-shot-list:shot_list_opening:video-take-production'
    );
  });

  it('preview returns a preflight report', async () => {
    const app = mount();
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionGroup: PRODUCTION_GROUP }),
      }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preflight.finalTake.purpose).toBe('shot.video-take');
    expect(typeof body.preflight.agentBrief).toBe('string');
  });

  it('plan accepts inputPolicy and delegates to core', async () => {
    const planShotVideoTakeProduction = vi.fn(
      fakeProjectDataService().planShotVideoTakeProduction
    );
    const app = mount({ planShotVideoTakeProduction });
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/plan',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionGroup: PRODUCTION_GROUP,
          inputPolicy: {
            defaultMode: 'auto',
            slotModes: { 'first-frame': 'regenerate' },
          },
        }),
      }
    );
    expect(response.status).toBe(200);
    expect(planShotVideoTakeProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        productionGroupId: 'scene_shot_video_take_group_001',
        production: { intentId: 'text-only' },
        inputPolicy: {
          defaultMode: 'auto',
          slotModes: { 'first-frame': 'regenerate' },
        },
      })
    );
    const body = await response.json();
    expect(body.plan.planId).toBe('shot_video_take_plan_fake');
  });

  it('estimate delegates to core and returns an estimate report', async () => {
    const estimateShotVideoTakeProduction = vi.fn(
      fakeProjectDataService().estimateShotVideoTakeProduction
    );
    const app = mount({ estimateShotVideoTakeProduction });
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/estimate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionGroup: PRODUCTION_GROUP }),
      }
    );
    expect(response.status).toBe(200);
    expect(estimateShotVideoTakeProduction).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        productionGroupId: 'scene_shot_video_take_group_001',
        production: { intentId: 'text-only' },
      })
    );
    const body = await response.json();
    expect(body.estimate.estimate.estimatedCostUsd).toBe(0.42);
  });

  it('input select delegates to core and returns resource keys', async () => {
    const selectShotVideoTakeInput = vi.fn(
      fakeProjectDataService().selectShotVideoTakeInput
    );
    const app = mount({ selectShotVideoTakeInput });
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/inputs/select',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIds: ['shot_001'], inputId: 'input_001' }),
      }
    );
    expect(response.status).toBe(200);
    expect(selectShotVideoTakeInput).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: 'scene_opening',
        shotListId: 'shot_list_opening',
        shotIds: ['shot_001'],
        inputId: 'input_001',
      })
    );
    const body = await response.json();
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('input clear delegates to core and returns resource keys', async () => {
    const clearShotVideoTakeInputSelection = vi.fn(
      fakeProjectDataService().clearShotVideoTakeInputSelection
    );
    const app = mount({ clearShotVideoTakeInputSelection });
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/inputs/clear',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotIds: ['shot_001'],
          kind: 'first-frame',
          subjectKind: 'shot',
          subjectId: 'shot_001',
        }),
      }
    );
    expect(response.status).toBe(200);
    expect(clearShotVideoTakeInputSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'first-frame',
        subjectKind: 'shot',
        subjectId: 'shot_001',
      })
    );
    const body = await response.json();
    expect(body.resourceKeys.length).toBeGreaterThan(0);
  });

  it('input clear requires non-empty shotIds', async () => {
    const app = mount();
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production/inputs/clear',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shotIds: [], kind: 'first-frame' }),
      }
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('STUDIO_SERVER343');
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
    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-take-production?shotIds=shot_001'
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('PROJECT_DATA360');
    expect(body.error.suggestion).toBe('Fix it.');
  });
});
