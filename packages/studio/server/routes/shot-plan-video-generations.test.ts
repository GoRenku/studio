import type {
  Asset,
  SceneShotPlanVideoGenerations,
} from '@gorenku/studio-core/client';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createShotPlanVideoGenerationsRoute } from './shot-plan-video-generations.js';

describe('Shot Plan video generations Hono route', () => {
  it('preserves Core grouping and adds safe Asset file URLs', async () => {
    const listSceneShotPlanVideoGenerations = vi.fn(async () => resource());
    const app = mountedRoute({ listSceneShotPlanVideoGenerations });

    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/video-generations',
    );
    const body = await response.json();

    expect(listSceneShotPlanVideoGenerations).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
    });
    expect(response.status).toBe(200);
    expect(body.resource.groups).toEqual([
      expect.objectContaining({
        kind: 'shotPlan',
        shotPlan: { id: 'plan_one', title: 'Council coverage' },
        assets: [
          expect.objectContaining({
            id: 'asset_video',
            files: [
              expect.objectContaining({
                browserUrl:
                  '/studio-api/projects/constantinople/assets/asset_video/files/file_video',
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({ kind: 'miscellaneous' }),
    ]);
    expect(JSON.stringify(body)).not.toContain('/tmp/renku');
  });

  it('discards the exact Project-owned Asset through Core', async () => {
    const discardAsset = vi.fn(async () => ({
      valid: true as const,
      project: {
        id: 'project_test0001',
        projectName: 'constantinople',
        projectFolder: '/tmp/renku/constantinople',
      },
      changes: [],
      recovery: {
        operationId: 'operation_discard_video',
        trashItemIds: ['trash_video'],
        restorable: true,
        restoreCommand: {
          name: 'trash.restore' as const,
          trashItemId: 'trash_video',
        },
      },
      warnings: [],
      resourceKeys: ['surface:scene:scene_opening:video-generations'],
    }));
    const app = mountedRoute({ discardAsset });

    const response = await app.request(
      '/constantinople/project-assets/asset%20video',
      { method: 'DELETE' },
    );

    expect(discardAsset).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'project' },
      assetId: 'asset video',
    });
    expect(response.status).toBe(200);
  });
});

function mountedRoute(
  overrides: Partial<ReturnType<typeof fakeProjectDataService>>,
) {
  return new Hono().route(
    '/:projectName',
    createShotPlanVideoGenerationsRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
      requireToken: async (_c, next) => {
        await next();
      },
    }),
  );
}

function resource(): SceneShotPlanVideoGenerations {
  return {
    sceneId: 'scene_opening',
    groups: [
      {
        kind: 'shotPlan',
        shotPlan: { id: 'plan_one', title: 'Council coverage' },
        assets: [videoAsset()],
      },
      {
        kind: 'miscellaneous',
        assets: [],
      },
    ],
    resourceKeys: ['surface:scene:scene_opening:video-generations'],
  };
}

function videoAsset(): Asset {
  return {
    id: 'asset_video',
    owner: { kind: 'project' },
    localeId: null,
    type: 'shot_plan_video',
    availability: 'ready',
    mediaKind: 'video',
    title: 'Council master',
    oneLineSummary: null,
    origin: 'generated',
    referenceName: null,
    purpose: 'shot-plan.video-generation',
    files: [
      {
        id: 'file_video',
        role: 'primary',
        projectRelativePath:
          'videos/council-master.mp4' as Asset['files'][number]['projectRelativePath'],
        mediaKind: 'video',
        mimeType: 'video/mp4',
        sizeBytes: 24,
        contentHash: null,
        width: null,
        height: null,
        durationSeconds: 4,
      },
    ],
    createdAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z',
  };
}
