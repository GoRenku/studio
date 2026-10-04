import { listAssetFilesInSession } from '../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashFileDraft,
  TrashObjectDiscardContext,
  TrashObjectGarbageCollectionContext,
  TrashObjectRestoreContext,
} from '../trash/trash-object-definition.js';
import {
  collectAssetFile,
  markAssetFileDiscarded,
  restoreAssetFile,
} from '../trash/asset-file-lifecycle.js';

export interface ShotImageLifecycleSnapshot {
  shotId: string;
  assetFileIds: string[];
}

export function snapshotShotImages(
  session: DatabaseSession,
  shotId: string
): ShotImageLifecycleSnapshot {
  return {
    shotId,
    assetFileIds: listAssetFilesInSession(session, {
      owner: { kind: 'shot', id: shotId },
      type: 'shot_image',
    }).map((assetFile) => assetFile.id),
  };
}

export function discardShotImages(
  input: TrashObjectDiscardContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const assetFileId of snapshot.assetFileIds) {
    markAssetFileDiscarded({ ...input, itemId: assetFileId });
  }
}

export function restoreShotImages(
  input: TrashObjectRestoreContext,
  snapshot: ShotImageLifecycleSnapshot
): void {
  for (const assetFileId of snapshot.assetFileIds) {
    const assetFile = readAssetFileRecordIncludingDiscarded(input.session, assetFileId);
    if (!assetFile) {
      throw new ProjectDataError(
        'CORE_SHOT_PLAN_STORAGE_INVALID',
        `Shot image Asset was not found during restore: ${assetFileId}.`
      );
    }
    if (assetFile.discardedAt !== null) {
      restoreAssetFile({
        ...input,
        trashItem: { ...input.trashItem, itemId: assetFileId },
      });
    }
  }
}

export function collectShotImageFiles(
  input: TrashObjectGarbageCollectionContext,
  snapshots: ShotImageLifecycleSnapshot[]
): TrashFileDraft[] {
  return [
    ...new Set(snapshots.flatMap((snapshot) => snapshot.assetFileIds)),
  ].flatMap((assetFileId) => collectAssetFile(input, assetFileId));
}
