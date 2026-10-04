import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { LookbookSheet } from '../../../client/index.js';
import { assetFiles, lookbookSheets } from '../../schema/index.js';
import { assetFileOwnerKey, parseAssetFileOwnerKey } from '../../asset-files/owner-keys.js';
import { readOwnedAssetFile } from '../../asset-files/projection.js';
import { ProjectDataError } from '../../project-data-error.js';
import { requireLookbookRecordById } from './lookbook.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookSheetRecord = typeof lookbookSheets.$inferSelect;

export function nextLookbookSheetSortOrder(
  session: DatabaseSession,
  lookbookId: string
): number {
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${lookbookSheets.sortOrder})` })
    .from(lookbookSheets)
    .innerJoin(assetFiles, eq(assetFiles.id, lookbookSheets.assetFileId))
    .where(and(
      eq(assetFiles.ownerKey, assetFileOwnerKey({ kind: 'lookbook', id: lookbookId })),
      isNull(lookbookSheets.discardedAt)
    ))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function insertLookbookSheetRecord(
  session: DatabaseSession,
  input: { id: string; assetFileId: string; sortOrder: number; now: string }
): void {
  session.db.insert(lookbookSheets).values({
    id: input.id,
    assetFileId: input.assetFileId,
    sortOrder: input.sortOrder,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function readLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): LookbookSheetRecord | null {
  return session.db.select().from(lookbookSheets)
    .where(and(eq(lookbookSheets.id, sheetId), isNull(lookbookSheets.discardedAt)))
    .get() ?? null;
}

export function readLookbookSheetRecordByAssetFile(
  session: DatabaseSession,
  input: { lookbookId: string; assetFileId: string }
): LookbookSheetRecord | null {
  return session.db
    .select({
      id: lookbookSheets.id,
      assetFileId: lookbookSheets.assetFileId,
      sortOrder: lookbookSheets.sortOrder,
      createdAt: lookbookSheets.createdAt,
      updatedAt: lookbookSheets.updatedAt,
      discardedAt: lookbookSheets.discardedAt,
      discardOperationId: lookbookSheets.discardOperationId,
      restoredAt: lookbookSheets.restoredAt,
    })
    .from(lookbookSheets)
    .innerJoin(assetFiles, eq(assetFiles.id, lookbookSheets.assetFileId))
    .where(and(
      eq(assetFiles.ownerKey, assetFileOwnerKey({ kind: 'lookbook', id: input.lookbookId })),
      eq(lookbookSheets.assetFileId, input.assetFileId),
      isNull(lookbookSheets.discardedAt)
    ))
    .get() ?? null;
}

export function requireLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): LookbookSheetRecord {
  const row = readLookbookSheetRecord(session, sheetId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA411',
      `Lookbook sheet was not found: ${sheetId}.`
    );
  }
  return row;
}

export function deleteLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): void {
  session.db.delete(lookbookSheets).where(eq(lookbookSheets.id, sheetId)).run();
}

export function setLookbookSheetRecordOrder(
  session: DatabaseSession,
  input: { sheetId: string; sortOrder: number; now: string }
): void {
  session.db.update(lookbookSheets)
    .set({ sortOrder: input.sortOrder, updatedAt: input.now })
    .where(eq(lookbookSheets.id, input.sheetId)).run();
}

export function listLookbookSheets(
  session: DatabaseSession,
  lookbookId: string
): LookbookSheet[] {
  const records = session.db
    .select({
      id: lookbookSheets.id,
      assetFileId: lookbookSheets.assetFileId,
      sortOrder: lookbookSheets.sortOrder,
      createdAt: lookbookSheets.createdAt,
      updatedAt: lookbookSheets.updatedAt,
      discardedAt: lookbookSheets.discardedAt,
      discardOperationId: lookbookSheets.discardOperationId,
      restoredAt: lookbookSheets.restoredAt,
    })
    .from(lookbookSheets)
    .innerJoin(assetFiles, eq(assetFiles.id, lookbookSheets.assetFileId))
    .where(and(
      eq(assetFiles.ownerKey, assetFileOwnerKey({ kind: 'lookbook', id: lookbookId })),
      isNull(lookbookSheets.discardedAt)
    ))
    .orderBy(asc(lookbookSheets.sortOrder), asc(lookbookSheets.id))
    .all();
  return records.map((record) => projectLookbookSheet(session, lookbookId, record));
}

export function readLookbookSheet(
  session: DatabaseSession,
  sheetId: string
): LookbookSheet | null {
  const record = readLookbookSheetRecord(session, sheetId);
  if (!record) {
    return null;
  }
  const ownerKey = session.db.select({ value: assetFiles.ownerKey })
    .from(assetFiles)
    .where(eq(assetFiles.id, record.assetFileId))
    .get()?.value;
  const owner = ownerKey ? parseAssetFileOwnerKey(ownerKey) : null;
  if (owner?.kind !== 'lookbook') {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Lookbook sheet ${sheetId} has invalid Asset ownership.`
    );
  }
  return projectLookbookSheet(
    session,
    owner.id,
    record
  );
}

function projectLookbookSheet(
  session: DatabaseSession,
  lookbookId: string,
  record: LookbookSheetRecord
): LookbookSheet {
  const lookbook = requireLookbookRecordById(session, lookbookId);
  const assetFile = readOwnedAssetFile(session, {
    owner: { kind: 'lookbook', id: lookbookId },
    assetFileId: record.assetFileId,
  });
  if (!assetFile) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Lookbook sheet ${record.id} has no active owned Asset.`
    );
  }
  return {
    id: record.id,
    lookbookId,
    lookbookKind: lookbook.kind,
    assetFile,
  };
}
