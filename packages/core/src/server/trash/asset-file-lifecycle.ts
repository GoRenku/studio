import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { eq, inArray } from 'drizzle-orm';
import { assetFiles, shotPlanClips, shotPlanClipTakes } from '../schema/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashFileDraft,
  TrashObjectDiscardContext,
  TrashObjectGarbageCollectionContext,
  TrashObjectRestoreContext,
} from './trash-object-definition.js';

export function markAssetFileDiscarded(
  input: TrashObjectDiscardContext
): void {
  input.session.db.update(shotPlanClips).set({ selectedTakeId: null })
    .where(inArray(shotPlanClips.selectedTakeId, input.session.db.select({ id: shotPlanClipTakes.id })
      .from(shotPlanClipTakes).where(eq(shotPlanClipTakes.assetFileId, input.itemId)))).run();
  input.session.db
    .update(assetFiles)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(assetFiles.id, input.itemId))
    .run();
}

export function restoreAssetFile(
  input: TrashObjectRestoreContext
): void {
  const assetFileId = input.trashItem.itemId;
  input.session.db
    .update(assetFiles)
    .set({
      discardedAt: null,
      discardOperationId: null,
      restoredAt: input.now,
    })
    .where(eq(assetFiles.id, assetFileId))
    .run();
}

export function collectAssetFile(
  input: TrashObjectGarbageCollectionContext,
  assetFileId: string
): TrashFileDraft[] {
  const assetFile = input.session.db
    .select()
    .from(assetFiles)
    .where(eq(assetFiles.id, assetFileId))
    .get();
  if (!assetFile) {
    throw new ProjectDataError(
      'PROJECT_DATA277',
      `Trash garbage collection could not find AssetFile: ${assetFileId}.`
    );
  }
  if (!assetFile.discardedAt) {
    throw garbageCollectionBlocker({
      trashItemId: input.trashItem.id,
      assetFileId,
      message: 'Trash garbage collection cannot collect an active AssetFile row.',
      suggestion:
        'Discard the file through its owning domain command before emptying Trash.',
    });
  }
  if (assetFile.discardOperationId !== input.trashItem.operationId) {
    return [];
  }
  return [{
    trashItemId: input.trashItem.id,
    originalProjectRelativePath: assetFile.projectRelativePath,
  }];
}

export function requireAssetFileSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { assetFileId: string } {
  if (typeof snapshot.assetFileId === 'string') {
    return { assetFileId: snapshot.assetFileId };
  }
  throw new ProjectDataError(
    'PROJECT_DATA268',
    `Trash item snapshot is missing AssetFile id: ${trashItemId}.`
  );
}

function garbageCollectionBlocker(input: {
  trashItemId: string;
  assetFileId: string;
  message: string;
  suggestion: string;
}): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA280', input.message, {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA280',
        input.message,
        { path: ['trashItem', input.trashItemId, 'assetFile', input.assetFileId] },
        input.suggestion
      ),
    ],
    suggestion: input.suggestion,
  });
}
