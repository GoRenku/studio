import { asc } from 'drizzle-orm';
import { clips, episodes, scenes, sequences } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

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
  session: ProjectDataSession,
  record: InsertEpisodeRecord
): void {
  session.db.insert(episodes).values(record).run();
}

export function insertSequenceRecord(
  session: ProjectDataSession,
  record: InsertSequenceRecord
): void {
  session.db.insert(sequences).values(record).run();
}

export function insertSceneRecord(
  session: ProjectDataSession,
  record: InsertSceneRecord
): void {
  session.db.insert(scenes).values(record).run();
}

export function insertClipRecord(
  session: ProjectDataSession,
  record: InsertClipRecord
): void {
  session.db.insert(clips).values(record).run();
}

export function listEpisodeRecords(session: ProjectDataSession): EpisodeRecord[] {
  return session.db.select().from(episodes).orderBy(asc(episodes.position)).all();
}

export function listSequenceRecords(session: ProjectDataSession): SequenceRecord[] {
  return session.db.select().from(sequences).orderBy(asc(sequences.position)).all();
}

export function listSceneRecords(session: ProjectDataSession): SceneRecord[] {
  return session.db.select().from(scenes).orderBy(asc(scenes.position)).all();
}

export function listClipRecords(session: ProjectDataSession): ClipRecord[] {
  return session.db.select().from(clips).orderBy(asc(clips.position)).all();
}
