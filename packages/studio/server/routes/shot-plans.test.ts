import type {
  Asset,
  RecoverableMutationReport,
  ShotPlanListReport,
  ShotPlanReport,
} from '@gorenku/studio-core/client';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAsset } from '../testing/route-fixtures.js';
import { createShotPlansRoute } from './shot-plans.js';

describe('Shot Plans Hono route', () => {
  it('preserves Core order and exposes browser URLs only for selected media', async () => {
    const listSceneShotPlans = vi.fn(async () => shotPlanListReport());
    const app = mountedRoute({ listSceneShotPlans });

    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/shot-plans'
    );
    const body = await response.json();

    expect(listSceneShotPlans).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
    });
    expect(response.status).toBe(200);
    expect(body.shotPlans[0].shotPlan.shots.map((shot: { id: string }) => shot.id))
      .toEqual(['shot_second', 'shot_first']);
    expect(body.shotPlans[0].coveredBeats.map(
      (coveredBeat: { position: number }) => coveredBeat.position
    )).toEqual([6, 4]);
    expect(body.shotPlans[0].shotPlan.shots[0].images).toMatchObject([
      { id: 'asset_unselected', files: [] },
      {
        id: 'asset_selected',
        files: [{
          url: '/studio-api/projects/constantinople/assets/asset_selected/files/file_asset_selected',
        }],
      },
    ]);
    expect(body.shotPlans[0].coveredBeats[0].storyboardImage).toEqual({
      assetId: 'asset_storyboard',
      assetFileId: 'asset_file_storyboard',
      url: '/studio-api/projects/constantinople/assets/asset_storyboard/files/asset_file_storyboard',
    });
    expect(JSON.stringify(body)).not.toContain('/tmp/renku');
    expect(body.warnings).toEqual([
      expect.objectContaining({ code: 'SHOT_PLAN_TEST_WARNING' }),
    ]);
  });

  it('passes the exact plan id to recoverable deletion', async () => {
    const report = recoverableReport();
    const deleteShotPlan = vi.fn(async () => report);
    const app = mountedRoute({ deleteShotPlan });

    const response = await app.request(
      '/constantinople/screenplay/shot-plans/plan%20one',
      { method: 'DELETE' }
    );

    expect(deleteShotPlan).toHaveBeenCalledWith({
      projectName: 'constantinople',
      shotPlanId: 'plan one',
    });
    await expect(response.json()).resolves.toEqual({
      valid: true,
      changes: report.changes,
      recovery: report.recovery,
      warnings: [],
      resourceKeys: ['surface:scene:scene_opening:shot-plans'],
    });
  });

  it('selects and discards candidates through common Core commands', async () => {
    const selectAsset = vi.fn(async () => ({
      valid: true as const,
      project: {
        id: 'project_test0001',
        name: 'constantinople',
        projectFolder: '/tmp/renku/constantinople',
      },
      target: { kind: 'shot' as const, id: 'shot_second' },
      selectedAssetId: 'asset_selected',
      warnings: [],
      resourceKeys: ['surface:scene:scene_opening:shot-plans'],
    }));
    const discardAsset = vi.fn(async () => recoverableReport());
    const app = mountedRoute({ selectAsset, discardAsset });

    const selected = await app.request(
      '/constantinople/screenplay/shots/shot_second/selected-image/asset_selected',
      { method: 'POST' }
    );
    const discarded = await app.request(
      '/constantinople/screenplay/shots/shot_second/images/asset_unselected',
      { method: 'DELETE' }
    );

    expect(selectAsset).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target: { kind: 'shot', id: 'shot_second' },
      assetId: 'asset_selected',
    });
    expect(discardAsset).toHaveBeenCalledWith({
      projectName: 'constantinople',
      owner: { kind: 'shot', id: 'shot_second' },
      assetId: 'asset_unselected',
    });
    await expect(selected.json()).resolves.toEqual({
      valid: true,
      selectedAssetId: 'asset_selected',
      warnings: [],
      resourceKeys: ['surface:scene:scene_opening:shot-plans'],
    });
    const discardedBody = await discarded.json();
    expect(discardedBody).toEqual({
      valid: true,
      changes: recoverableReport().changes,
      recovery: recoverableReport().recovery,
      warnings: [],
      resourceKeys: ['surface:scene:scene_opening:shot-plans'],
    });
    expect(JSON.stringify(discardedBody)).not.toContain('/tmp/renku');
  });
});

function mountedRoute(
  overrides: Partial<ReturnType<typeof fakeProjectDataService>>
) {
  return new Hono().route(
    '/:projectName',
    createShotPlansRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

function shotPlanListReport(): ShotPlanListReport {
  const report = shotPlanReport();
  return {
    valid: true,
    project: report.project,
    shotPlans: [{
      shotPlan: report.shotPlan,
      coveredBeats: report.coveredBeats,
    }],
    warnings: [{
      code: 'SHOT_PLAN_TEST_WARNING',
      severity: 'warning',
      message: 'Fixture warning.',
      location: { path: [] },
    }],
    resourceKeys: report.resourceKeys,
  };
}

function shotPlanReport(): ShotPlanReport {
  return {
    valid: true,
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      projectFolder: '/tmp/renku/constantinople',
    },
    shotPlan: {
      id: 'plan_one',
      sceneId: 'scene_opening',
      title: 'Council coverage',
      coverage: null,
      shots: [
        {
          id: 'shot_second',
          position: 1,
          title: 'Second Shot',
          description: 'The second authored Shot.',
          brief: {},
          images: [
            shotAsset('asset_unselected', 'shot_second'),
            shotAsset('asset_selected', 'shot_second'),
          ],
          selectedImageId: 'asset_selected',
        },
        {
          id: 'shot_first',
          position: 0,
          title: 'First Shot',
          description: 'The first authored Shot.',
          brief: {},
          images: [],
          selectedImageId: null,
        },
      ],
      createdAt: '2026-07-27T10:00:00.000Z',
      updatedAt: '2026-07-27T10:00:00.000Z',
    },
    coveredBeats: [
      {
        beat: {
          id: 'beat_006',
          title: 'The order',
          description: 'The order is given.',
          narrativeDevelopment: 'The decision hardens.',
          narrativePurpose: 'Commit the council.',
          screenplayBlockIndexes: [0],
          castMemberIds: [],
          locationIds: [],
        },
        position: 6,
        storyboardImage: {
          assetId: 'asset_storyboard',
          assetFileId: 'asset_file_storyboard',
        },
      },
      {
        beat: {
          id: 'beat_004',
          title: 'The map',
          description: 'The map is studied.',
          narrativeDevelopment: 'The risk becomes visible.',
          narrativePurpose: 'Frame the siege problem.',
          screenplayBlockIndexes: [0],
          castMemberIds: [],
          locationIds: [],
        },
        position: 4,
        storyboardImage: null,
      },
    ],
    warnings: [],
    resourceKeys: ['surface:scene:scene_opening:shot-plans'],
  };
}

function shotAsset(assetId: string, shotId: string): Asset {
  const asset = makeAsset(assetId);
  return {
    ...asset,
    owner: { kind: 'shot', id: shotId },
    type: 'shot_image',
    title: 'Shot image',
    files: asset.files.map((file) => ({
      ...file,
      id: `file_${assetId}`,
      projectRelativePath:
        `generated/${assetId}.png` as Asset['files'][number]['projectRelativePath'],
    })),
  };
}

function recoverableReport(): RecoverableMutationReport {
  return {
    valid: true,
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      projectFolder: '/tmp/renku/constantinople',
    },
    changes: [{ type: 'asset.discarded', assetId: 'asset_unselected' }],
    recovery: {
      operationId: 'trash_operation_test0001',
      trashItemIds: ['trash_item_test0001'],
      restorable: true,
      restoreCommand: {
        name: 'trash.restore',
        trashItemId: 'trash_item_test0001',
      },
    },
    warnings: [],
    resourceKeys: ['surface:scene:scene_opening:shot-plans'],
  };
}
