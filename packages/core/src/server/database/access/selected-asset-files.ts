import { eq } from 'drizzle-orm';
import { selectedAssetFiles } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SelectedAssetFileRecord = typeof selectedAssetFiles.$inferSelect;

export function readSelectedAssetFileRecord(
  session: DatabaseSession,
  targetKey: string
): SelectedAssetFileRecord | null {
  return session.db
    .select()
    .from(selectedAssetFiles)
    .where(eq(selectedAssetFiles.targetKey, targetKey))
    .get() ?? null;
}

export function writeSelectedAssetFileRecord(
  session: DatabaseSession,
  input: { targetKey: string; assetFileId: string; now: string }
): void {
  const existing = readSelectedAssetFileRecord(session, input.targetKey);
  if (existing) {
    session.db
      .update(selectedAssetFiles)
      .set({ assetFileId: input.assetFileId, updatedAt: input.now })
      .where(eq(selectedAssetFiles.targetKey, input.targetKey))
      .run();
    return;
  }
  session.db.insert(selectedAssetFiles).values({
    targetKey: input.targetKey,
    assetFileId: input.assetFileId,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function clearSelectedAssetFileRecord(
  session: DatabaseSession,
  targetKey: string
): void {
  session.db
    .delete(selectedAssetFiles)
    .where(eq(selectedAssetFiles.targetKey, targetKey))
    .run();
}

export function clearSelectedAssetFileRecordForAssetFile(
  session: DatabaseSession,
  assetFileId: string
): void {
  session.db
    .delete(selectedAssetFiles)
    .where(eq(selectedAssetFiles.assetFileId, assetFileId))
    .run();
}
