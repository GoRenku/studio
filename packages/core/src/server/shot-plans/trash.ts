import { and, eq, isNull } from 'drizzle-orm';
import { shotPlans, shots } from '../schema/index.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';
import type { TrashObjectDefinition } from '../trash/trash-object-definition.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  collectShotImageFiles,
  discardShotImages,
  restoreShotImages,
  snapshotShotImages,
  type ShotImageLifecycleSnapshot,
} from './image-lifecycle.js';
import { listShotRecords, writeShotOrder } from '../database/access/shot-plans/shot-records.js';

export const shotPlanTrashDefinition: TrashObjectDefinition = {
  itemKind: 'shotPlan',
  readTrashItems(input) {
    const shotPlan = input.session.db
      .select()
      .from(shotPlans)
      .where(
        and(eq(shotPlans.id, input.itemId), isNull(shotPlans.discardedAt))
      )
      .get();
    if (!shotPlan) {
      return [];
    }
    const shotSnapshots = listShotRecords(input.session, shotPlan.id).map(
      (shot) => ({
        shotId: shot.id,
        position: shot.position,
        images: snapshotShotImages(input.session, shot.id),
      })
    );
    return [
      {
        itemKind: 'shotPlan',
        itemId: shotPlan.id,
        ownerKind: 'scene',
        ownerId: shotPlan.sceneId,
        title: shotPlan.title,
        restoreSnapshot: {
          sceneId: shotPlan.sceneId,
          shots: shotSnapshots,
        },
      },
    ];
  },
  applyDiscard(input) {
    const shotPlan = input.session.db
      .select()
      .from(shotPlans)
      .where(eq(shotPlans.id, input.itemId))
      .get();
    if (!shotPlan) {
      return;
    }
    const shotRecords = listShotRecords(input.session, shotPlan.id);
    for (const shot of shotRecords) {
      discardShotImages(input, snapshotShotImages(input.session, shot.id));
    }
    input.session.db
      .update(shots)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(shots.shotPlanId, input.itemId))
      .run();
    input.session.db
      .update(shotPlans)
      .set({
        discardedAt: input.now,
        discardOperationId: input.operationId,
        restoredAt: null,
        updatedAt: input.now,
      })
      .where(eq(shotPlans.id, input.itemId))
      .run();
  },
  applyRestore(input) {
    const snapshot = requireShotPlanTrashSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    input.session.db
      .update(shotPlans)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(shotPlans.id, input.trashItem.itemId),
          eq(shotPlans.discardOperationId, input.trashItem.operationId)
        )
      )
      .run();
    input.session.db
      .update(shots)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(shots.shotPlanId, input.trashItem.itemId))
      .run();
    writeShotOrder(input.session, {
      shotPlanId: input.trashItem.itemId,
      orderedShotIds: snapshot.shots
        .sort((left, right) => left.position - right.position)
        .map((shot) => shot.shotId),
      now: input.now,
    });
    for (const shot of snapshot.shots) {
      restoreShotImages(input, shot.images);
    }
  },
  collectFiles(input) {
    const snapshot = requireShotPlanTrashSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    return collectShotImageFiles(
      input,
      snapshot.shots.map((shot) => shot.images)
    );
  },
  resourceKeys(input) {
    if (!input.ownerId) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot Plan Trash item is missing its Scene owner: ${input.itemId}.`
      );
    }
    return [studioSceneShotPlansResourceKey(input.ownerId)];
  },
  restoredChanges(input) {
    return [{ type: 'shotPlan.restored', shotPlanId: input.itemId }];
  },
};

function requireShotPlanTrashSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): {
  sceneId: string;
  shots: Array<{
    shotId: string;
    position: number;
    images: ShotImageLifecycleSnapshot;
  }>;
} {
  if (
    typeof snapshot.sceneId !== 'string' ||
    !Array.isArray(snapshot.shots)
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Shot Plan Trash snapshot is invalid: ${trashItemId}.`
    );
  }
  const shotSnapshots = snapshot.shots as Array<Record<string, unknown>>;
  if (
    shotSnapshots.some(
      (shot) =>
        typeof shot.shotId !== 'string' ||
        typeof shot.position !== 'number' ||
        !isShotImageSnapshot(shot.images)
    )
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Shot Plan Trash snapshot has invalid Shot data: ${trashItemId}.`
    );
  }
  return {
    sceneId: snapshot.sceneId,
    shots: shotSnapshots as Array<{
      shotId: string;
      position: number;
      images: ShotImageLifecycleSnapshot;
    }>,
  };
}

function isShotImageSnapshot(
  value: unknown
): value is ShotImageLifecycleSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'shotId' in value &&
    typeof value.shotId === 'string' &&
    'assets' in value &&
    Array.isArray(value.assets) &&
    value.assets.every(
      (asset) =>
        typeof asset === 'object' &&
        asset !== null &&
        'assetId' in asset &&
        typeof asset.assetId === 'string' &&
        'discardedAsset' in asset &&
        typeof asset.discardedAsset === 'boolean'
    )
  );
}
