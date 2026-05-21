import { asc } from 'drizzle-orm';
import { sceneAssets, sequenceAssets } from '../../../schema/index.js';
import { ProjectDataError } from '../../../project-data-error.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export type SequenceAssetRecord = typeof sequenceAssets.$inferSelect;
export type SceneAssetRecord = typeof sceneAssets.$inferSelect;
export interface ClipAssetRecord {
  id: string;
  clipId: string;
  assetId: string;
  localeId: string | null;
  role: string;
  sortOrder: number;
  selection: string;
  selectionOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

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
  session: DatabaseSession,
  record: InsertSequenceAssetRecord
): void {
  session.db.insert(sequenceAssets).values(record).run();
}

export function insertSceneAssetRecord(
  session: DatabaseSession,
  record: InsertSceneAssetRecord
): void {
  session.db.insert(sceneAssets).values(record).run();
}

export function insertClipAssetRecord(
  session: DatabaseSession,
  record: InsertClipAssetRecord
): void {
  void session;
  void record;
  throw new ProjectDataError(
    'PROJECT_DATA207',
    'Clip assets are not part of the current screenplay data model.'
  );
}

export function listSequenceAssetRecords(
  session: DatabaseSession
): SequenceAssetRecord[] {
  return session.db
    .select()
    .from(sequenceAssets)
    .orderBy(asc(sequenceAssets.sortOrder))
    .all();
}

export function listSceneAssetRecords(session: DatabaseSession): SceneAssetRecord[] {
  return session.db.select().from(sceneAssets).orderBy(asc(sceneAssets.sortOrder)).all();
}

export function listClipAssetRecords(session: DatabaseSession): ClipAssetRecord[] {
  void session;
  return [];
}
