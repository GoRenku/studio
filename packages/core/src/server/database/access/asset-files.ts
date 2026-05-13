import { and, eq } from 'drizzle-orm';
import { assetFiles } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type AssetFileRecord = typeof assetFiles.$inferSelect;

export interface InsertAssetFileRecord {
  id: string;
  assetId: string;
  role: string;
  projectRelativePath: string;
  mimeType?: string;
  mediaKind: string;
  sizeBytes?: number;
  contentHash?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export function insertAssetFileRecord(
  session: DatabaseSession,
  record: InsertAssetFileRecord
): void {
  session.db.insert(assetFiles).values(record).run();
}

export function listAssetFileRecords(session: DatabaseSession): AssetFileRecord[] {
  return session.db.select().from(assetFiles).all();
}

export function readAssetFileRecord(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): AssetFileRecord | null {
  return (
    session.db
      .select()
      .from(assetFiles)
      .where(
        and(
          eq(assetFiles.assetId, input.assetId),
          eq(assetFiles.id, input.assetFileId)
        )
      )
      .get() ?? null
  );
}

export function updateAssetFileRecordMetadata(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string; sizeBytes: number; updatedAt: string }
): void {
  session.db
    .update(assetFiles)
    .set({
      sizeBytes: input.sizeBytes,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(assetFiles.assetId, input.assetId),
        eq(assetFiles.id, input.assetFileId)
      )
    )
    .run();
}
