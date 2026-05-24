import { asc, eq, inArray } from 'drizzle-orm';
import type { InspirationFolderWithResolvedPath } from '../../../client/index.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../../files/project-relative-paths.js';
import { inspirationFolders, lookbookInspirations } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookInspirationRecord = typeof lookbookInspirations.$inferSelect;

export function listLookbookInspirationRecords(
  session: DatabaseSession,
  lookbookId: string
): LookbookInspirationRecord[] {
  return session.db
    .select()
    .from(lookbookInspirations)
    .where(eq(lookbookInspirations.lookbookId, lookbookId))
    .orderBy(asc(lookbookInspirations.sortOrder), asc(lookbookInspirations.id))
    .all();
}

export function listLookbookSourceInspirationFolders(
  session: DatabaseSession,
  input: { projectFolder: string; lookbookId: string }
): InspirationFolderWithResolvedPath[] {
  const rows = session.db
    .select({
      id: inspirationFolders.id,
      name: inspirationFolders.name,
      projectRelativePath: inspirationFolders.projectRelativePath,
    })
    .from(lookbookInspirations)
    .innerJoin(
      inspirationFolders,
      eq(inspirationFolders.id, lookbookInspirations.inspirationFolderId)
    )
    .where(eq(lookbookInspirations.lookbookId, input.lookbookId))
    .orderBy(asc(lookbookInspirations.sortOrder), asc(lookbookInspirations.id))
    .all();

  return rows.map((row) => {
    const projectRelativePath = normalizeProjectRelativePath(row.projectRelativePath);
    return {
      id: row.id,
      name: row.name,
      projectRelativePath,
      absolutePath: resolveProjectRelativePath(
        input.projectFolder,
        projectRelativePath
      ),
    };
  });
}

export function listLookbookSourceFoldersByLookbookId(
  session: DatabaseSession,
  input: { projectFolder: string; lookbookIds: string[] }
): Map<string, InspirationFolderWithResolvedPath[]> {
  const sourceFoldersByLookbookId = new Map<string, InspirationFolderWithResolvedPath[]>();
  if (input.lookbookIds.length === 0) {
    return sourceFoldersByLookbookId;
  }

  const rows = session.db
    .select({
      lookbookId: lookbookInspirations.lookbookId,
      id: inspirationFolders.id,
      name: inspirationFolders.name,
      projectRelativePath: inspirationFolders.projectRelativePath,
      sortOrder: lookbookInspirations.sortOrder,
    })
    .from(lookbookInspirations)
    .innerJoin(
      inspirationFolders,
      eq(inspirationFolders.id, lookbookInspirations.inspirationFolderId)
    )
    .where(inArray(lookbookInspirations.lookbookId, input.lookbookIds))
    .orderBy(
      asc(lookbookInspirations.lookbookId),
      asc(lookbookInspirations.sortOrder),
      asc(lookbookInspirations.id)
    )
    .all();

  for (const row of rows) {
    const projectRelativePath = normalizeProjectRelativePath(row.projectRelativePath);
    const existing = sourceFoldersByLookbookId.get(row.lookbookId) ?? [];
    existing.push({
      id: row.id,
      name: row.name,
      projectRelativePath,
      absolutePath: resolveProjectRelativePath(input.projectFolder, projectRelativePath),
    });
    sourceFoldersByLookbookId.set(row.lookbookId, existing);
  }

  return sourceFoldersByLookbookId;
}

export function replaceLookbookInspirationRecords(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    inspirationFolderIds: string[];
    nextId: () => string;
    now: string;
  }
): void {
  session.db
    .delete(lookbookInspirations)
    .where(eq(lookbookInspirations.lookbookId, input.lookbookId))
    .run();

  input.inspirationFolderIds.forEach((inspirationFolderId, index) => {
    session.db
      .insert(lookbookInspirations)
      .values({
        id: input.nextId(),
        lookbookId: input.lookbookId,
        inspirationFolderId,
        sortOrder: index + 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .run();
  });
}
