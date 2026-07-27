import { eq } from 'drizzle-orm';
import { selectedAssets } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SelectedAssetRecord = typeof selectedAssets.$inferSelect;

export function readSelectedAssetRecord(
  session: DatabaseSession,
  ownerKey: string
): SelectedAssetRecord | null {
  return session.db
    .select()
    .from(selectedAssets)
    .where(eq(selectedAssets.ownerKey, ownerKey))
    .get() ?? null;
}

export function writeSelectedAssetRecord(
  session: DatabaseSession,
  input: { ownerKey: string; assetId: string; now: string }
): void {
  const existing = readSelectedAssetRecord(session, input.ownerKey);
  if (existing) {
    session.db
      .update(selectedAssets)
      .set({ assetId: input.assetId, updatedAt: input.now })
      .where(eq(selectedAssets.ownerKey, input.ownerKey))
      .run();
    return;
  }
  session.db.insert(selectedAssets).values({
    ownerKey: input.ownerKey,
    assetId: input.assetId,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function clearSelectedAssetRecord(
  session: DatabaseSession,
  ownerKey: string
): void {
  session.db
    .delete(selectedAssets)
    .where(eq(selectedAssets.ownerKey, ownerKey))
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
