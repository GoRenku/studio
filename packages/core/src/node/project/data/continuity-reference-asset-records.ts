import { asc } from 'drizzle-orm';
import { continuityReferenceAssets } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type ContinuityReferenceAssetRecord =
  typeof continuityReferenceAssets.$inferSelect;

export interface InsertContinuityReferenceAssetRecord {
  id: string;
  continuityReferenceId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertContinuityReferenceAssetRecord(
  session: ProjectDataSession,
  record: InsertContinuityReferenceAssetRecord
): void {
  session.db.insert(continuityReferenceAssets).values(record).run();
}

export function listContinuityReferenceAssetRecords(
  session: ProjectDataSession
): ContinuityReferenceAssetRecord[] {
  return session.db
    .select()
    .from(continuityReferenceAssets)
    .orderBy(asc(continuityReferenceAssets.sortOrder))
    .all();
}
