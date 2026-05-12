import { eq } from 'drizzle-orm';
import { assets } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

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
  session: ProjectDataSession,
  record: InsertAssetRecord
): void {
  session.db.insert(assets).values(record).run();
}

export function listAssetRecords(session: ProjectDataSession): AssetRecord[] {
  return session.db.select().from(assets).all();
}

export function readAssetRecord(
  session: ProjectDataSession,
  assetId: string
): AssetRecord | null {
  return (
    session.db.select().from(assets).where(eq(assets.id, assetId)).get() ?? null
  );
}

export function updateAssetRecordUpdatedAt(
  session: ProjectDataSession,
  input: { assetId: string; updatedAt: string }
): void {
  session.db
    .update(assets)
    .set({ updatedAt: input.updatedAt })
    .where(eq(assets.id, input.assetId))
    .run();
}
