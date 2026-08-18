import { eq } from 'drizzle-orm';
import { selectedAssets } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SelectedAssetRecord = typeof selectedAssets.$inferSelect;

export function readSelectedAssetRecord(
  session: DatabaseSession,
  targetKey: string
): SelectedAssetRecord | null {
  return session.db
    .select()
    .from(selectedAssets)
    .where(eq(selectedAssets.targetKey, targetKey))
    .get() ?? null;
}

export function writeSelectedAssetRecord(
  session: DatabaseSession,
  input: { targetKey: string; assetId: string; now: string }
): void {
  const existing = readSelectedAssetRecord(session, input.targetKey);
  if (existing) {
    session.db
      .update(selectedAssets)
      .set({ assetId: input.assetId, updatedAt: input.now })
      .where(eq(selectedAssets.targetKey, input.targetKey))
      .run();
    return;
  }
  session.db.insert(selectedAssets).values({
    targetKey: input.targetKey,
    assetId: input.assetId,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function clearSelectedAssetRecord(
  session: DatabaseSession,
  targetKey: string
): void {
  session.db
    .delete(selectedAssets)
    .where(eq(selectedAssets.targetKey, targetKey))
    .run();
}

export function clearSelectedAssetRecordForAsset(
  session: DatabaseSession,
  assetId: string
): void {
  session.db
    .delete(selectedAssets)
    .where(eq(selectedAssets.assetId, assetId))
    .run();
}
