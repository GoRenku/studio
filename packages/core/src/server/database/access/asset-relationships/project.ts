import { asc } from 'drizzle-orm';
import { projectAssets } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export type ProjectAssetRecord = typeof projectAssets.$inferSelect;

export interface InsertProjectAssetRecord {
  id: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertProjectAssetRecord(
  session: DatabaseSession,
  record: InsertProjectAssetRecord
): void {
  session.db.insert(projectAssets).values(record).run();
}

export function listProjectAssetRecords(
  session: DatabaseSession
): ProjectAssetRecord[] {
  return session.db
    .select()
    .from(projectAssets)
    .orderBy(asc(projectAssets.sortOrder))
    .all();
}
