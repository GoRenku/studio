import { and, eq, isNull } from 'drizzle-orm';
import { assetFiles } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';

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
  assertDurableAssetFilePath(record.projectRelativePath);
  session.db.insert(assetFiles).values(record).run();
}

function assertDurableAssetFilePath(projectRelativePath: string): void {
  if (projectRelativePath === 'generated' || projectRelativePath.startsWith('generated/')) {
    throw new ProjectDataError(
      'PROJECT_DATA445',
      `Durable asset files must not be registered under generated/: ${projectRelativePath}.`
    );
  }
  if (projectRelativePath === 'research' || projectRelativePath.startsWith('research/')) {
    throw new ProjectDataError(
      'PROJECT_DATA446',
      `Durable asset files must not be registered under research/: ${projectRelativePath}.`
    );
  }
}

export function listAssetFileRecords(session: DatabaseSession): AssetFileRecord[] {
  return session.db
    .select()
    .from(assetFiles)
    .where(isNull(assetFiles.discardedAt))
    .all();
}

export function listAssetFileRecordsForAsset(
  session: DatabaseSession,
  assetId: string
): AssetFileRecord[] {
  return session.db
    .select()
    .from(assetFiles)
    .where(and(eq(assetFiles.assetId, assetId), isNull(assetFiles.discardedAt)))
    .all();
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
          eq(assetFiles.id, input.assetFileId),
          isNull(assetFiles.discardedAt)
        )
      )
      .get() ?? null
  );
}

export function readAssetFileRecordIncludingDiscarded(
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

export function readAssetFileRecordByIdIncludingDiscarded(
  session: DatabaseSession,
  assetFileId: string,
): AssetFileRecord | null {
  return (
    session.db
      .select()
      .from(assetFiles)
      .where(eq(assetFiles.id, assetFileId))
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

export function deleteAssetFileRecordsForAsset(
  session: DatabaseSession,
  assetId: string
): void {
  session.db.delete(assetFiles).where(eq(assetFiles.assetId, assetId)).run();
}
