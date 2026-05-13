import { asc } from 'drizzle-orm';
import { clips, episodes, scenes, sequences } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type EpisodeRecord = typeof episodes.$inferSelect;
export type SequenceRecord = typeof sequences.$inferSelect;
export type SceneRecord = typeof scenes.$inferSelect;
export type ClipRecord = typeof clips.$inferSelect;

export interface InsertEpisodeRecord {
  id: string;
  title: string;
  shortTitle?: string;
  episodeNumber?: number;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertSequenceRecord {
  id: string;
  episodeId: string | null;
  title: string;
  shortTitle?: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertSceneRecord {
  id: string;
  sequenceId: string;
  title: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertClipRecord {
  id: string;
  sceneId: string;
  title: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertEpisodeRecord(
  session: DatabaseSession,
  record: InsertEpisodeRecord
): void {
  session.db.insert(episodes).values(record).run();
}

export function insertSequenceRecord(
  session: DatabaseSession,
  record: InsertSequenceRecord
): void {
  session.db.insert(sequences).values(record).run();
}

export function insertSceneRecord(
  session: DatabaseSession,
  record: InsertSceneRecord
): void {
  session.db.insert(scenes).values(record).run();
}

export function insertClipRecord(
  session: DatabaseSession,
  record: InsertClipRecord
): void {
  session.db.insert(clips).values(record).run();
}

export function listEpisodeRecords(session: DatabaseSession): EpisodeRecord[] {
  return session.db.select().from(episodes).orderBy(asc(episodes.position)).all();
}

export function listSequenceRecords(session: DatabaseSession): SequenceRecord[] {
  return session.db.select().from(sequences).orderBy(asc(sequences.position)).all();
}

export function listSceneRecords(session: DatabaseSession): SceneRecord[] {
  return session.db.select().from(scenes).orderBy(asc(scenes.position)).all();
}

export function listClipRecords(session: DatabaseSession): ClipRecord[] {
  return session.db.select().from(clips).orderBy(asc(clips.position)).all();
}
