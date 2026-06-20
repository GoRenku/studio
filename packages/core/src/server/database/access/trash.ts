import { and, eq, isNull } from 'drizzle-orm';
import type { TrashItemKind } from '../../../client/index.js';
import { trashItems } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

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
