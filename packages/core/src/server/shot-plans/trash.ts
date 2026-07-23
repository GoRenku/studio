import { and, eq, isNull } from 'drizzle-orm';
import { assets, shotPlans } from '../schema/index.js';
import { studioSceneShotsResourceKey } from '../studio-coordination/resource-keys.js';
import {
  collectAssetFiles,
  markAssetRecordAndFilesDiscarded,
  restoreAssetRecordAndFiles,
} from '../trash/asset-tree-lifecycle.js';
import type { TrashObjectDefinition } from '../trash/trash-object-definition.js';
import { ProjectDataError } from '../project-data-error.js';

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
    const videoAsset =
      shotPlan.videoAssetId === null
        ? null
        : input.session.db
            .select({
              id: assets.id,
              discardedAt: assets.discardedAt,
            })
            .from(assets)
            .where(eq(assets.id, shotPlan.videoAssetId))
            .get();
    return [
      {
        itemKind: 'shotPlan',
        itemId: shotPlan.id,
        ownerKind: 'scene',
        ownerId: shotPlan.sceneId,
        title: shotPlan.title,
        restoreSnapshot: {
          sceneId: shotPlan.sceneId,
          videoAssetId: shotPlan.videoAssetId,
          discardedVideoAsset:
            videoAsset !== null &&
            videoAsset !== undefined &&
            videoAsset.discardedAt === null,
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
    if (shotPlan.videoAssetId === null) {
      return;
    }
    const asset = input.session.db
      .select({ discardedAt: assets.discardedAt })
      .from(assets)
      .where(eq(assets.id, shotPlan.videoAssetId))
      .get();
    if (asset?.discardedAt === null) {
      markAssetRecordAndFilesDiscarded({
        ...input,
        itemId: shotPlan.videoAssetId,
      });
    }
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
    if (!snapshot.discardedVideoAsset || snapshot.videoAssetId === null) {
      return;
    }
    const asset = input.session.db
      .select({ discardOperationId: assets.discardOperationId })
      .from(assets)
      .where(eq(assets.id, snapshot.videoAssetId))
      .get();
    if (asset?.discardOperationId === input.trashItem.operationId) {
      restoreAssetRecordAndFiles({
        ...input,
        trashItem: {
          ...input.trashItem,
          itemId: snapshot.videoAssetId,
        },
      });
    }
  },
  collectFiles(input) {
    const snapshot = requireShotPlanTrashSnapshot(
      input.snapshot,
      input.trashItem.id
    );
    return snapshot.discardedVideoAsset && snapshot.videoAssetId !== null
      ? collectAssetFiles(input, snapshot.videoAssetId)
      : [];
  },
  resourceKeys(input) {
    if (!input.ownerId) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot Plan Trash item is missing its Scene owner: ${input.itemId}.`
      );
    }
    return [studioSceneShotsResourceKey(input.ownerId)];
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
  videoAssetId: string | null;
  discardedVideoAsset: boolean;
} {
  if (
    typeof snapshot.sceneId === 'string' &&
    (typeof snapshot.videoAssetId === 'string' ||
      snapshot.videoAssetId === null) &&
    typeof snapshot.discardedVideoAsset === 'boolean'
  ) {
    return {
      sceneId: snapshot.sceneId,
      videoAssetId: snapshot.videoAssetId,
      discardedVideoAsset: snapshot.discardedVideoAsset,
    };
  }
  throw new ProjectDataError(
    'CORE_SHOT_PLAN_STORAGE_INVALID',
    `Shot Plan Trash snapshot is invalid: ${trashItemId}.`
  );
}
