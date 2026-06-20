import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { PageResponse } from '../../../client/index.js';
import { inspirationFolders } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  decodeProjectPageCursor,
  encodeProjectPageCursor,
  normalizeProjectPageLimit,
} from './page-cursors.js';

const DEFAULT_INSPIRATION_FOLDER_PAGE_LIMIT = 60;
const MAX_INSPIRATION_FOLDER_PAGE_LIMIT = 200;

export type InspirationFolderRecord = typeof inspirationFolders.$inferSelect;

export interface InsertInspirationFolderRecord {
  id: string;
  name: string;
  projectRelativePath: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertInspirationFolderRecord(
  session: DatabaseSession,
  record: InsertInspirationFolderRecord
): void {
  session.db.insert(inspirationFolders).values(record).run();
}

export function readInspirationFolderRecord(
  session: DatabaseSession,
  folderId: string
): InspirationFolderRecord | null {
  return (
    session.db
      .select()
      .from(inspirationFolders)
      .where(
        and(eq(inspirationFolders.id, folderId), isNull(inspirationFolders.discardedAt))
      )
      .get() ?? null
  );
}

export function listInspirationFolderRecords(
  session: DatabaseSession,
  input: { limit?: number; cursor?: string | null } = {}
): PageResponse<InspirationFolderRecord> {
  const limit = normalizeProjectPageLimit(input.limit, {
    defaultLimit: DEFAULT_INSPIRATION_FOLDER_PAGE_LIMIT,
    maxLimit: MAX_INSPIRATION_FOLDER_PAGE_LIMIT,
  });
  const cursor = parseFolderCursor(input.cursor);
  const rows = session.db
    .select()
    .from(inspirationFolders)
    .where(
      and(
        isNull(inspirationFolders.discardedAt),
        cursor ? gt(inspirationFolders.position, cursor.position) : undefined
      )
    )
    .orderBy(asc(inspirationFolders.position), asc(inspirationFolders.id))
    .limit(limit + 1)
    .all();
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows,
    nextCursor:
      rows.length > limit
        ? encodeProjectPageCursor({
            position: pageRows[pageRows.length - 1]!.position,
          })
        : null,
  };
}

export function listAllInspirationFolderRecords(
  session: DatabaseSession
): InspirationFolderRecord[] {
  return session.db
    .select()
    .from(inspirationFolders)
    .where(isNull(inspirationFolders.discardedAt))
    .orderBy(asc(inspirationFolders.position), asc(inspirationFolders.id))
    .all();
}

export function nextInspirationFolderPosition(session: DatabaseSession): number {
  const row = session.db
    .select({ maxPosition: sql<number | null>`max(${inspirationFolders.position})` })
    .from(inspirationFolders)
    .where(isNull(inspirationFolders.discardedAt))
    .get();
  return (row?.maxPosition ?? 0) + 1;
}

export function updateInspirationFolderRecord(
  session: DatabaseSession,
  input: {
    folderId: string;
    name: string;
    projectRelativePath: string;
    updatedAt: string;
  }
): void {
  session.db
    .update(inspirationFolders)
    .set({
      name: input.name,
      projectRelativePath: input.projectRelativePath,
      updatedAt: input.updatedAt,
    })
    .where(eq(inspirationFolders.id, input.folderId))
    .run();
}

export function updateInspirationFolderPositions(
  session: DatabaseSession,
  input: { folderIds: string[]; updatedAt: string }
): void {
  input.folderIds.forEach((folderId, index) => {
    session.db
      .update(inspirationFolders)
      .set({ position: index + 1, updatedAt: input.updatedAt })
      .where(eq(inspirationFolders.id, folderId))
      .run();
  });
}

export function deleteInspirationFolderRecord(
  session: DatabaseSession,
  folderId: string
): void {
  session.db
    .delete(inspirationFolders)
    .where(eq(inspirationFolders.id, folderId))
    .run();
}

export function requireInspirationFolderRecord(
  session: DatabaseSession,
  folderId: string
): InspirationFolderRecord {
  const folder = readInspirationFolderRecord(session, folderId);
  if (!folder) {
    throw new ProjectDataError(
      'PROJECT_DATA231',
      `Inspiration folder was not found: ${folderId}.`
    );
  }
  return folder;
}

function parseFolderCursor(cursor: string | null | undefined): { position: number } | null {
  const value = decodeProjectPageCursor(cursor);
  if (!value) {
    return null;
  }
  if (typeof value.position !== 'number') {
    throw new ProjectDataError('PROJECT_DATA109', 'Page cursor is invalid.');
  }
  return { position: value.position };
}
