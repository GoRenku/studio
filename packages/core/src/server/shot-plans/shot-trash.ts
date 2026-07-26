import { and, eq, isNull } from 'drizzle-orm';
import { shots } from '../schema/index.js';
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
import {
  discardShotRecord,
  listShotRecords,
  writeShotOrder,
} from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';

export const shotTrashDefinition: TrashObjectDefinition = {
  itemKind: 'shot',
  readTrashItems(input) {
    const shot = input.session.db
      .select()
      .from(shots)
      .where(and(eq(shots.id, input.itemId), isNull(shots.discardedAt)))
      .get();
    if (!shot) {
      return [];
    }
    const plan = requireShotPlanRecord(input.session, shot.shotPlanId);
    return [
      {
        itemKind: 'shot',
        itemId: shot.id,
        ownerKind: 'scene',
        ownerId: plan.sceneId,
        title: shot.title,
        restoreSnapshot: {
          shotPlanId: shot.shotPlanId,
          position: shot.position,
          images: snapshotShotImages(input.session, shot.id),
        },
      },
    ];
  },
  applyDiscard(input) {
    const shot = input.session.db
      .select()
      .from(shots)
      .where(eq(shots.id, input.itemId))
      .get();
    if (!shot) {
      return;
    }
    discardShotImages(input, snapshotShotImages(input.session, shot.id));
    discardShotRecord(input.session, {
      shotId: shot.id,
      shotPlanId: shot.shotPlanId,
      operationId: input.operationId,
      now: input.now,
    });
    writeShotOrder(input.session, {
      shotPlanId: shot.shotPlanId,
      orderedShotIds: listShotRecords(input.session, shot.shotPlanId).map(
        (record) => record.id
      ),
      now: input.now,
    });
  },
  applyRestore(input) {
    const snapshot = requireShotSnapshot(input.snapshot, input.trashItem.id);
    const current = listShotRecords(input.session, snapshot.shotPlanId);
    input.session.db
      .update(shots)
      .set({
        discardedAt: null,
        discardOperationId: null,
        restoredAt: input.now,
        updatedAt: input.now,
      })
      .where(eq(shots.id, input.trashItem.itemId))
      .run();
    const orderedIds = current.map((shot) => shot.id);
    orderedIds.splice(
      Math.min(snapshot.position, orderedIds.length),
      0,
      input.trashItem.itemId
    );
    writeShotOrder(input.session, {
      shotPlanId: snapshot.shotPlanId,
      orderedShotIds: orderedIds,
      now: input.now,
    });
    restoreShotImages(input, snapshot.images);
  },
  collectFiles(input) {
    const snapshot = requireShotSnapshot(input.snapshot, input.trashItem.id);
    return collectShotImageFiles(input, [snapshot.images]);
  },
  resourceKeys(input) {
    if (!input.ownerId) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot Trash item is missing its Scene owner: ${input.itemId}.`
      );
    }
    return [studioSceneShotPlansResourceKey(input.ownerId)];
  },
  restoredChanges(input) {
    return [{ type: 'shot.restored', shotId: input.itemId }];
  },
};

function requireShotSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): {
  shotPlanId: string;
  position: number;
  images: ShotImageLifecycleSnapshot;
} {
  if (
    typeof snapshot.shotPlanId === 'string' &&
    typeof snapshot.position === 'number' &&
    isShotImageSnapshot(snapshot.images)
  ) {
    return {
      shotPlanId: snapshot.shotPlanId,
      position: snapshot.position,
      images: snapshot.images,
    };
  }
  throw new ProjectDataError(
    'CORE_SHOT_PLAN_STORAGE_INVALID',
    `Shot Trash snapshot is invalid: ${trashItemId}.`
  );
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
