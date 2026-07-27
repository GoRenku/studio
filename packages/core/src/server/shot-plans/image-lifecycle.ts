import { listAssetsInSession } from '../assets/projection.js';
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
  assetIds: string[];
}

export function snapshotShotImages(
  session: DatabaseSession,
  shotId: string
): ShotImageLifecycleSnapshot {
  return {
    shotId,
    assetIds: listAssetsInSession(session, {
      owner: { kind: 'shot', id: shotId },
      type: 'shot_image',
    }).map((asset) => asset.id),
  };
}

export function discardShotImages(
  input: TrashObjectDiscardContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const assetId of snapshot.assetIds) {
    markAssetRecordAndFilesDiscarded({ ...input, itemId: assetId });
  }
}

export function restoreShotImages(
  input: TrashObjectRestoreContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const assetId of snapshot.assetIds) {
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
  }
}

export function collectShotImageFiles(
  input: TrashObjectGarbageCollectionContext,
  snapshots: ShotImageLifecycleSnapshot[]
): TrashFileDraft[] {
  return [
    ...new Set(snapshots.flatMap((snapshot) => snapshot.assetIds)),
  ].flatMap((assetId) => collectAssetFiles(input, assetId));
}
