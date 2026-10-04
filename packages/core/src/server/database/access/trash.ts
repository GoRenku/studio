import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { TrashItemKind } from '../../../client/index.js';
import { trashItems } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function isInspirationFolderGarbageCollected(
  session: DatabaseSession,
  input: { folderId: string; discardOperationId: string }
): boolean {
  return session.db
    .select({ id: trashItems.id })
    .from(trashItems)
    .where(and(
      eq(trashItems.itemKind, 'inspirationFolder'),
      eq(trashItems.itemId, input.folderId),
      eq(trashItems.operationId, input.discardOperationId),
      isNull(trashItems.restoredAt),
      isNotNull(trashItems.garbageCollectedAt)
    ))
    .get() !== undefined;
}

export function listActiveTrashItemOriginalProjectRelativePaths(
  session: DatabaseSession,
  input: {
    itemKind: TrashItemKind;
    ownerKind: string;
    ownerId: string;
  }
): string[] {
  return session.db
    .select({ originalProjectRelativePath: trashItems.originalProjectRelativePath })
    .from(trashItems)
    .where(
      and(
        eq(trashItems.itemKind, input.itemKind),
        eq(trashItems.ownerKind, input.ownerKind),
        eq(trashItems.ownerId, input.ownerId),
        isNull(trashItems.restoredAt),
        isNull(trashItems.garbageCollectedAt)
      )
    )
    .all()
    .map((row) => row.originalProjectRelativePath)
    .filter((projectRelativePath): projectRelativePath is string =>
      Boolean(projectRelativePath)
    );
}
