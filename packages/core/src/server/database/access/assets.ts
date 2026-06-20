import { eq, isNull } from 'drizzle-orm';
import { assets } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type AssetRecord = typeof assets.$inferSelect;

export interface InsertAssetRecord {
  id: string;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string;
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

export function insertAssetRecord(
  session: DatabaseSession,
  record: InsertAssetRecord
): void {
  session.db.insert(assets).values(record).run();
}

export function listAssetRecords(session: DatabaseSession): AssetRecord[] {
  return session.db
    .select()
    .from(assets)
    .where(isNull(assets.discardedAt))
    .all();
}

export function readAssetRecord(
  session: DatabaseSession,
  assetId: string
): AssetRecord | null {
  return (
    session.db.select().from(assets).where(eq(assets.id, assetId)).get() ?? null
  );
}

export function updateAssetRecordUpdatedAt(
  session: DatabaseSession,
  input: { assetId: string; updatedAt: string }
): void {
  session.db
    .update(assets)
    .set({ updatedAt: input.updatedAt })
    .where(eq(assets.id, input.assetId))
    .run();
}

export function updateAssetRecordMetadata(
  session: DatabaseSession,
  input: {
    assetId: string;
    title?: string;
    oneLineSummary?: string | null;
    updatedAt: string;
  }
): void {
  const values: Partial<typeof assets.$inferInsert> = {
    updatedAt: input.updatedAt,
  };
  if (input.title !== undefined) {
    values.title = input.title;
  }
  if (input.oneLineSummary !== undefined) {
    values.oneLineSummary = input.oneLineSummary ?? null;
  }
  session.db.update(assets).set(values).where(eq(assets.id, input.assetId)).run();
}

export function deleteAssetRecord(session: DatabaseSession, assetId: string): void {
  session.db.delete(assets).where(eq(assets.id, assetId)).run();
}
