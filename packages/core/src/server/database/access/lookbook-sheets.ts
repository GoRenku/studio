import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { LookbookSheet } from '../../../client/index.js';
import { assetMemberships, lookbookSheets } from '../../schema/index.js';
import { assetOwnerKey, parseAssetOwnerKey } from '../../assets/owner-keys.js';
import { readOwnedAsset } from '../../assets/projection.js';
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
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookSheets.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: lookbookId })),
      isNull(lookbookSheets.discardedAt)
    ))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function insertLookbookSheetRecord(
  session: DatabaseSession,
  input: { id: string; assetId: string; sortOrder: number; now: string }
): void {
  session.db.insert(lookbookSheets).values({
    id: input.id,
    assetId: input.assetId,
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

export function readLookbookSheetRecordByAsset(
  session: DatabaseSession,
  input: { lookbookId: string; assetId: string }
): LookbookSheetRecord | null {
  return session.db
    .select({
      id: lookbookSheets.id,
      assetId: lookbookSheets.assetId,
      sortOrder: lookbookSheets.sortOrder,
      createdAt: lookbookSheets.createdAt,
      updatedAt: lookbookSheets.updatedAt,
      discardedAt: lookbookSheets.discardedAt,
      discardOperationId: lookbookSheets.discardOperationId,
      restoredAt: lookbookSheets.restoredAt,
    })
    .from(lookbookSheets)
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookSheets.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: input.lookbookId })),
      eq(lookbookSheets.assetId, input.assetId),
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
      assetId: lookbookSheets.assetId,
      sortOrder: lookbookSheets.sortOrder,
      createdAt: lookbookSheets.createdAt,
      updatedAt: lookbookSheets.updatedAt,
      discardedAt: lookbookSheets.discardedAt,
      discardOperationId: lookbookSheets.discardOperationId,
      restoredAt: lookbookSheets.restoredAt,
    })
    .from(lookbookSheets)
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookSheets.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: lookbookId })),
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
  const ownerKey = session.db.select({ value: assetMemberships.ownerKey })
    .from(assetMemberships)
    .where(eq(assetMemberships.assetId, record.assetId))
    .get()?.value;
  const owner = ownerKey ? parseAssetOwnerKey(ownerKey) : null;
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
  const asset = readOwnedAsset(session, {
    owner: { kind: 'lookbook', id: lookbookId },
    assetId: record.assetId,
  });
  if (!asset) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Lookbook sheet ${record.id} has no active owned Asset.`
    );
  }
  return {
    id: record.id,
    lookbookId,
    lookbookKind: lookbook.kind,
    asset,
  };
}
