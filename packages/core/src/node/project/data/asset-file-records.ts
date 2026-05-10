import { assetFiles } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type AssetFileRecord = typeof assetFiles.$inferSelect;

export interface InsertAssetFileRecord {
  id: string;
  assetId: string;
  role: string;
  projectRelativePath: string;
  mimeType?: string;
  mediaKind: string;
  sizeBytes?: number;
  contentHash?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export function insertAssetFileRecord(
  session: ProjectDataSession,
  record: InsertAssetFileRecord
): void {
  session.db.insert(assetFiles).values(record).run();
}

export function listAssetFileRecords(session: ProjectDataSession): AssetFileRecord[] {
  return session.db.select().from(assetFiles).all();
}
