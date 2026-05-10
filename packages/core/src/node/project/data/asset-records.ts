import { assets } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type AssetRecord = typeof assets.$inferSelect;

export interface InsertAssetRecord {
  id: string;
  assetType: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string;
  origin: string;
  status: string;
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
