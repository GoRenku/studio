import { and, asc, eq, isNull } from 'drizzle-orm';
import { assetFiles } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import { assertDurableProjectAssetFilePath } from '../../project-asset-files/path-guards.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';

export type AssetFileRecord = typeof assetFiles.$inferSelect;
export type InsertAssetFileRecord = typeof assetFiles.$inferInsert;

export function insertAssetFileRecord(
  session: DatabaseSession,
  record: InsertAssetFileRecord
): void {
  const projectRelativePath = normalizeProjectRelativePath(record.projectRelativePath);
  assertDurableProjectAssetFilePath(projectRelativePath);
  session.db.insert(assetFiles).values({ ...record, projectRelativePath }).run();
}

export function listAssetFileRecords(session: DatabaseSession): AssetFileRecord[] {
  return session.db.select().from(assetFiles).where(isNull(assetFiles.discardedAt)).all();
}

export function listAssetFileRecordsIncludingDiscarded(session: DatabaseSession): AssetFileRecord[] {
  return session.db.select().from(assetFiles).all();
}

/** Every file of one owner and type, discarded ones included, oldest first. */
export function listAssetFileRecordsForOwnerTypeIncludingDiscarded(
  session: DatabaseSession,
  input: { ownerKey: string; type: string }
): AssetFileRecord[] {
  return session.db.select().from(assetFiles)
    .where(and(eq(assetFiles.ownerKey, input.ownerKey), eq(assetFiles.type, input.type)))
    .orderBy(asc(assetFiles.createdAt), asc(assetFiles.id))
    .all();
}

export function readAssetFileRecord(
  session: DatabaseSession,
  assetFileId: string
): AssetFileRecord | null {
  return session.db.select().from(assetFiles)
    .where(and(eq(assetFiles.id, assetFileId), isNull(assetFiles.discardedAt))).get() ?? null;
}

export function readAssetFileRecordIncludingDiscarded(
  session: DatabaseSession,
  assetFileId: string
): AssetFileRecord | null {
  return session.db.select().from(assetFiles).where(eq(assetFiles.id, assetFileId)).get() ?? null;
}

export function readAssetFileRecordByPath(
  session: DatabaseSession,
  projectRelativePath: string
): AssetFileRecord | null {
  return session.db.select().from(assetFiles)
    .where(eq(assetFiles.projectRelativePath, normalizeProjectRelativePath(projectRelativePath))).get() ?? null;
}

export function updateAssetFileRecordUpdatedAt(
  session: DatabaseSession,
  input: { assetFileId: string; updatedAt: string }
): void {
  session.db.update(assetFiles).set({ updatedAt: input.updatedAt }).where(eq(assetFiles.id, input.assetFileId)).run();
}

export function updateAssetFileRecordMetadata(
  session: DatabaseSession,
  input: {
    assetFileId: string;
    title?: string | null;
    oneLineSummary?: string | null;
    referenceName?: string | null;
    tags?: string[];
    localeId?: string | null;
    sizeBytes?: number;
    updatedAt: string;
  }
): void {
  const { assetFileId, ...values } = input;
  session.db.update(assetFiles).set(values).where(eq(assetFiles.id, assetFileId)).run();
}

export function deleteAssetFileRecord(session: DatabaseSession, assetFileId: string): void {
  session.db.delete(assetFiles).where(eq(assetFiles.id, assetFileId)).run();
}
