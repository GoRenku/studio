import type {
  ShotPlanDialogueAudioMutationReport,
  ShotPlanDialogueAudioResource,
} from '@gorenku/studio-core/client';
import { Hono, type MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createShotPlanDialogueAudioRoute } from './shot-plan-dialogue-audio.js';

describe('Shot Plan Dialogue Audio Hono route', () => {
  it('reads the exact Shot Plan resource without provider interpretation', async () => {
    const readShotPlanDialogueAudio = vi.fn(async () => resource());
    const app = mountedRoute({ readShotPlanDialogueAudio });

    const response = await app.request(
      '/constantinople/screenplay/shot-plans/plan%20one/dialogue-audio',
    );

    expect(readShotPlanDialogueAudio).toHaveBeenCalledWith({
      projectName: 'constantinople',
      shotPlanId: 'plan one',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      takes: [{
        turnRange: { start: 2, end: 4 },
        selected: true,
        asset: { generationProvenance: { provider: 'opaque-provider', model: 'opaque-model' } },
      }],
    });
  });

  it('delegates independent multi-selection and deletion to Core', async () => {
    const selectShotPlanDialogueAudioTake = vi.fn(async () => mutation());
    const clearShotPlanDialogueAudioTakeSelection = vi.fn(async () => mutation());
    const discardShotPlanDialogueAudioTake = vi.fn(async () => mutation());
    const requireToken = vi.fn<MiddlewareHandler>(async (_c, next) => next());
    const app = mountedRoute({
      selectShotPlanDialogueAudioTake,
      clearShotPlanDialogueAudioTakeSelection,
      discardShotPlanDialogueAudioTake,
    }, requireToken);

    await app.request(
      '/constantinople/screenplay/shot-plans/plan%20one/dialogue-audio/takes/take%201/selection',
      { method: 'PUT' },
    );
    await app.request(
      '/constantinople/screenplay/shot-plans/plan%20one/dialogue-audio/takes/take%201/selection',
      { method: 'DELETE' },
    );
    await app.request(
      '/constantinople/screenplay/shot-plans/plan%20one/dialogue-audio/takes/take%201',
      { method: 'DELETE' },
    );

    const expected = {
      projectName: 'constantinople',
      shotPlanId: 'plan one',
      takeId: 'take 1',
    };
    expect(selectShotPlanDialogueAudioTake).toHaveBeenCalledWith(expected);
    expect(clearShotPlanDialogueAudioTakeSelection).toHaveBeenCalledWith(expected);
    expect(discardShotPlanDialogueAudioTake).toHaveBeenCalledWith(expected);
    expect(requireToken).toHaveBeenCalledTimes(3);
  });
});

function mountedRoute(
  overrides: Partial<ReturnType<typeof fakeProjectDataService>>,
  requireToken: MiddlewareHandler = async (_c, next) => next(),
) {
  return new Hono().route(
    '/:projectName',
    createShotPlanDialogueAudioRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
      requireToken,
    }),
  );
}

function resource(): ShotPlanDialogueAudioResource {
  return {
    shotPlan: { id: 'plan one', sceneId: 'scene_1', title: 'Plan' },
    takes: [{
      id: 'take 1',
      shotPlanId: 'plan one',
      turnRange: { start: 2, end: 4 },
      selected: true,
      speakers: [],
      createdAt: '2026-08-31T10:00:00.000Z',
      updatedAt: '2026-08-31T10:00:00.000Z',
      asset: {
        id: 'asset_1',
        localeId: null,
        type: 'shot_plan_dialogue_audio',
        mediaKind: 'audio',
        title: 'Turns 2–4',
        oneLineSummary: null,
        referenceName: null,
        tags: [],
        origin: 'generated',
        availability: 'ready',
        owner: { kind: 'project' },
        files: [],
        generationProvenance: {
          provider: 'opaque-provider',
          model: 'opaque-model',
          mediaKind: 'audio',
          prompt: null,
          request: {},
        },
        authoredFrom: { kind: 'shotPlan', id: 'plan one' },
        createdAt: '2026-08-31T10:00:00.000Z',
        updatedAt: '2026-08-31T10:00:00.000Z',
      },
    }],
    resourceKeys: ['surface:shotPlan:plan one:dialogue-audio'],
  };
}

function mutation(): ShotPlanDialogueAudioMutationReport {
  return {
    valid: true,
    warnings: [],
    resource: resource(),
    resourceKeys: resource().resourceKeys,
  };
}
