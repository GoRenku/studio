import { asc } from 'drizzle-orm';
import { visualLanguageAssets } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export type VisualLanguageAssetRecord = typeof visualLanguageAssets.$inferSelect;

export interface InsertVisualLanguageAssetRecord {
  id: string;
  visualLanguageId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertVisualLanguageAssetRecord(
  session: DatabaseSession,
  record: InsertVisualLanguageAssetRecord
): void {
  session.db.insert(visualLanguageAssets).values(record).run();
}

export function listVisualLanguageAssetRecords(
  session: DatabaseSession
): VisualLanguageAssetRecord[] {
  return session.db
    .select()
    .from(visualLanguageAssets)
    .orderBy(asc(visualLanguageAssets.sortOrder))
    .all();
}
