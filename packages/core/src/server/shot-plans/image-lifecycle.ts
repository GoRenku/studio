import type { AssetTarget } from '../../client/assets.js';
import {
  discardAssetRelationshipRecord,
  listAssetRelationships,
  readAssetOwnerTargets,
  restoreAssetRelationshipRecord,
} from '../database/access/asset-relationships/index.js';
import { readAssetRecord } from '../database/access/assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashFileDraft,
  TrashObjectDiscardContext,
  TrashObjectGarbageCollectionContext,
  TrashObjectRestoreContext,
} from '../trash/trash-object-definition.js';
import {
  collectAssetFiles,
  markAssetRecordAndFilesDiscarded,
  restoreAssetRecordAndFiles,
} from '../trash/asset-tree-lifecycle.js';

export interface ShotImageLifecycleSnapshot {
  shotId: string;
  assets: Array<{
    assetId: string;
    discardedAsset: boolean;
  }>;
}

export function snapshotShotImages(
  session: DatabaseSession,
  shotId: string
): ShotImageLifecycleSnapshot {
  return {
    shotId,
    assets: listAssetRelationships(session, {
      target: shotTarget(shotId),
    }).map((asset) => ({
      assetId: asset.assetId,
      discardedAsset:
        readAssetOwnerTargets(session, asset.assetId).length === 1,
    })),
  };
}

export function discardShotImages(
  input: TrashObjectDiscardContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const { assetId } of snapshot.assets) {
    discardAssetRelationshipRecord(input.session, {
      target: shotTarget(snapshot.shotId),
      assetId,
      operationId: input.operationId,
      now: input.now,
    });
    if (readAssetOwnerTargets(input.session, assetId).length === 0) {
      markAssetRecordAndFilesDiscarded({ ...input, itemId: assetId });
    }
  }
}

export function restoreShotImages(
  input: TrashObjectRestoreContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const { assetId } of snapshot.assets) {
    const asset = readAssetRecord(input.session, assetId);
    if (!asset) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot image Asset was not found during restore: ${assetId}.`
      );
    }
    if (asset.discardedAt !== null) {
      restoreAssetRecordAndFiles({
        ...input,
        trashItem: { ...input.trashItem, itemId: assetId },
      });
    }
    restoreAssetRelationshipRecord(input.session, {
      target: shotTarget(snapshot.shotId),
      assetId,
      now: input.now,
    });
  }
}

export function collectShotImageFiles(
  input: TrashObjectGarbageCollectionContext,
  snapshots: ShotImageLifecycleSnapshot[]
): TrashFileDraft[] {
  return [
    ...new Set(
      snapshots.flatMap((snapshot) =>
        snapshot.assets.map((asset) => asset.assetId)
      )
    ),
  ].flatMap((assetId) => collectAssetFiles(input, assetId));
}

function shotTarget(shotId: string): Extract<AssetTarget, { kind: 'shot' }> {
  return { kind: 'shot', shotId };
}
