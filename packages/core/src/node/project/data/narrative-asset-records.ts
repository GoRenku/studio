import { asc } from 'drizzle-orm';
import { clipAssets, sceneAssets, sequenceAssets } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type SequenceAssetRecord = typeof sequenceAssets.$inferSelect;
export type SceneAssetRecord = typeof sceneAssets.$inferSelect;
export type ClipAssetRecord = typeof clipAssets.$inferSelect;

export interface InsertSequenceAssetRecord {
  id: string;
  sequenceId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertSceneAssetRecord {
  id: string;
  sceneId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertClipAssetRecord {
  id: string;
  clipId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertSequenceAssetRecord(
  session: ProjectDataSession,
  record: InsertSequenceAssetRecord
): void {
  session.db.insert(sequenceAssets).values(record).run();
}

export function insertSceneAssetRecord(
  session: ProjectDataSession,
  record: InsertSceneAssetRecord
): void {
  session.db.insert(sceneAssets).values(record).run();
}

export function insertClipAssetRecord(
  session: ProjectDataSession,
  record: InsertClipAssetRecord
): void {
  session.db.insert(clipAssets).values(record).run();
}

export function listSequenceAssetRecords(
  session: ProjectDataSession
): SequenceAssetRecord[] {
  return session.db
    .select()
    .from(sequenceAssets)
    .orderBy(asc(sequenceAssets.sortOrder))
    .all();
}

export function listSceneAssetRecords(session: ProjectDataSession): SceneAssetRecord[] {
  return session.db.select().from(sceneAssets).orderBy(asc(sceneAssets.sortOrder)).all();
}

export function listClipAssetRecords(session: ProjectDataSession): ClipAssetRecord[] {
  return session.db.select().from(clipAssets).orderBy(asc(clipAssets.sortOrder)).all();
}
