import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { assetFiles, assets } from '../schema/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  TrashFileDraft,
  TrashObjectDiscardContext,
  TrashObjectGarbageCollectionContext,
  TrashObjectRestoreContext,
} from './trash-object-definition.js';

export function markAssetTreeDiscarded(
  input: TrashObjectDiscardContext
): void {
  markAssetRecordAndFilesDiscarded(input);
}

export function markAssetRecordAndFilesDiscarded(
  input: TrashObjectDiscardContext
): void {
  input.session.db
    .update(assets)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(assets.id, input.itemId))
    .run();
  input.session.db
    .update(assetFiles)
    .set({
      discardedAt: input.now,
      discardOperationId: input.operationId,
      restoredAt: null,
    })
    .where(eq(assetFiles.assetId, input.itemId))
    .run();
}

export function restoreAssetTree(input: TrashObjectRestoreContext): void {
  restoreAssetRecordAndFiles(input);
}

export function restoreAssetRecordAndFiles(
  input: TrashObjectRestoreContext
): void {
  const assetId = input.trashItem.itemId;
  input.session.db
    .update(assets)
    .set({
      discardedAt: null,
      discardOperationId: null,
      restoredAt: input.now,
    })
    .where(eq(assets.id, assetId))
    .run();
  input.session.db
    .update(assetFiles)
    .set({
      discardedAt: null,
      discardOperationId: null,
      restoredAt: input.now,
    })
    .where(eq(assetFiles.assetId, assetId))
    .run();
}

export function collectAssetFiles(
  input: TrashObjectGarbageCollectionContext,
  assetId: string
): TrashFileDraft[] {
  const asset = input.session.db
    .select({
      discardedAt: assets.discardedAt,
      discardOperationId: assets.discardOperationId,
    })
    .from(assets)
    .where(eq(assets.id, assetId))
    .get();
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA277',
      `Trash garbage collection could not find asset: ${assetId}.`
    );
  }
  if (!asset.discardedAt) {
    throw garbageCollectionBlocker({
      trashItemId: input.trashItem.id,
      assetId,
      message: 'Trash garbage collection cannot collect an active asset row.',
      suggestion:
        'Discard the asset through its owning domain command before emptying Trash.',
    });
  }
  if (asset.discardOperationId !== input.trashItem.operationId) {
    return [];
  }
  const files = input.session.db
    .select()
    .from(assetFiles)
    .where(eq(assetFiles.assetId, assetId))
    .all();
  for (const file of files) {
    const activePathOwner = readActiveAssetFilePathOwner(input.session, {
      assetId,
      projectRelativePath: file.projectRelativePath,
    });
    if (activePathOwner) {
      throw garbageCollectionBlocker({
        trashItemId: input.trashItem.id,
        assetId,
        message:
          `Trash garbage collection cannot collect ${file.projectRelativePath} because active asset ${activePathOwner.assetId} owns that path.`,
        suggestion:
          'Move or discard the active asset file before emptying Trash.',
      });
    }
  }
  return files.map((file) => ({
    trashItemId: input.trashItem.id,
    originalProjectRelativePath: file.projectRelativePath,
  }));
}

export function requireAssetSnapshot(
  snapshot: Record<string, unknown>,
  trashItemId: string
): { assetId: string } {
  if (typeof snapshot.assetId === 'string') {
    return { assetId: snapshot.assetId };
  }
  throw new ProjectDataError(
    'PROJECT_DATA268',
    `Trash item snapshot is missing asset id: ${trashItemId}.`
  );
}

function readActiveAssetFilePathOwner(
  session: TrashObjectGarbageCollectionContext['session'],
  input: { assetId: string; projectRelativePath: string }
): { assetId: string; assetFileId: string } | null {
  return (
    session.db
      .select({ assetId: assetFiles.assetId, assetFileId: assetFiles.id })
      .from(assetFiles)
      .innerJoin(assets, eq(assetFiles.assetId, assets.id))
      .where(
        and(
          eq(assetFiles.projectRelativePath, input.projectRelativePath),
          ne(assetFiles.assetId, input.assetId),
          isNull(assetFiles.discardedAt),
          isNull(assets.discardedAt)
        )
      )
      .get() ?? null
  );
}

function garbageCollectionBlocker(input: {
  trashItemId: string;
  assetId: string;
  message: string;
  suggestion: string;
}): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA280', input.message, {
    issues: [
      createDiagnosticError(
        'PROJECT_DATA280',
        input.message,
        { path: ['trashItem', input.trashItemId, 'asset', input.assetId] },
        input.suggestion
      ),
    ],
    suggestion: input.suggestion,
  });
}
