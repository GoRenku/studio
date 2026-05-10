import { asc } from 'drizzle-orm';
import { castAssets } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type CastAssetRecord = typeof castAssets.$inferSelect;

export interface InsertCastAssetRecord {
  id: string;
  castMemberId: string;
  assetId: string;
  localeId?: string | null;
  assetRole: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertCastAssetRecord(
  session: ProjectDataSession,
  record: InsertCastAssetRecord
): void {
  session.db.insert(castAssets).values(record).run();
}

export function listCastAssetRecords(session: ProjectDataSession): CastAssetRecord[] {
  return session.db
    .select()
    .from(castAssets)
    .orderBy(asc(castAssets.sortOrder))
    .all();
}
