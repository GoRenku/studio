import { and, eq, isNull } from 'drizzle-orm';
import { assetFiles } from '../../schema/asset-files.js';
import { trashItems } from '../../schema/trash.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { updateInspirationFolderRecord } from './inspiration-folders.js';

export function prepareInspirationFolderPaths(session: DatabaseSession, input: {
  folderId: string; currentPath: string; nextPath: string;
}) {
  const ownerKey = `inspirationFolder:${encodeURIComponent(input.folderId)}`;
  const owned = session.db.select().from(assetFiles).where(eq(assetFiles.ownerKey, ownerKey)).all();
  const rows = owned.map((record) => {
    if (!record.projectRelativePath.startsWith(`${input.currentPath}/`)) {
      throw new ProjectDataError('CORE_REFERENCE_FILE_PATH_INVALID', 'Owned Inspiration files must remain in their folder.');
    }
    const next = normalizeProjectRelativePath(`${input.nextPath}/${record.projectRelativePath.slice(input.currentPath.length + 1)}`);
    const conflicting = session.db.select().from(assetFiles).where(eq(assetFiles.projectRelativePath, next)).get();
    if (conflicting && conflicting.id !== record.id) { throw new ProjectDataError('CORE_REFERENCE_FILE_CONFLICT', 'Renamed Inspiration paths conflict with registered files.'); }
    return { id: record.id, previous: record.projectRelativePath, next };
  });
  const liveTrash = session.db.select().from(trashItems).where(and(
    eq(trashItems.ownerKind, 'inspirationFolder'), eq(trashItems.ownerId, input.folderId),
    isNull(trashItems.restoredAt), isNull(trashItems.garbageCollectedAt),
  )).all();
  return { rows, liveTrash };
}

export function commitInspirationFolderPaths(session: DatabaseSession, input: {
  folderId: string; name: string; nextPath: string; now: string;
  prepared: ReturnType<typeof prepareInspirationFolderPaths>;
}): void {
  session.db.transaction((tx) => {
    const current = { ...session, db: tx };
    updateInspirationFolderRecord(current, { folderId: input.folderId, name: input.name,
      projectRelativePath: input.nextPath, updatedAt: input.now });
    for (const row of input.prepared.rows) {
      tx.update(assetFiles).set({ projectRelativePath: row.next }).where(eq(assetFiles.id, row.id)).run();
      for (const trash of input.prepared.liveTrash.filter((trash) => trash.itemId === row.id)) {
        const snapshot: Record<string, unknown> = JSON.parse(trash.restoreSnapshotJson);
        if (snapshot.originalProjectRelativePath === row.previous) { snapshot.originalProjectRelativePath = row.next; }
        tx.update(trashItems).set({ originalProjectRelativePath: row.next, restoreSnapshotJson: JSON.stringify(snapshot) })
          .where(eq(trashItems.id, trash.id)).run();
      }
    }
  });
}
