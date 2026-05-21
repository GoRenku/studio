import { asc, eq } from 'drizzle-orm';
import { acts, scenes, sequences } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface EpisodeRecord {
  id: string;
  title: string;
  shortTitle: string | null;
  episodeNumber: number | null;
  oneLineSummary: string | null;
  position: number;
}

export type SequenceRecord = typeof sequences.$inferSelect & {
  episodeId: string | null;
  shortTitle: string | null;
  oneLineSummary: string | null;
};
export type SceneRecord = typeof scenes.$inferSelect & {
  oneLineSummary: string | null;
};
export interface ClipRecord {
  id: string;
  sceneId: string;
  title: string;
  oneLineSummary: string | null;
  position: number;
}

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
  session.db.insert(acts).values({
    id: record.id,
    title: record.title,
    purpose: record.oneLineSummary ?? null,
    keyBeats: null,
    position: record.position,
  }).run();
}

export function insertSequenceRecord(
  session: DatabaseSession,
  record: InsertSequenceRecord
): void {
  const actId = record.episodeId ?? 'act_setup_default';
  ensureAct(session, actId);
  session.db.insert(sequences).values({
    id: record.id,
    actId,
    title: record.title,
    purpose: record.oneLineSummary ?? null,
    position: record.position,
  }).run();
}

export function insertSceneRecord(
  session: DatabaseSession,
  record: InsertSceneRecord
): void {
  session.db.insert(scenes).values({
    id: record.id,
    sequenceId: record.sequenceId,
    title: record.title,
    storyFunction: record.oneLineSummary ? JSON.stringify([record.oneLineSummary]) : null,
    position: record.position,
  }).run();
}

export function insertClipRecord(
  session: DatabaseSession,
  record: InsertClipRecord
): void {
  void session;
  void record;
}

export function listEpisodeRecords(session: DatabaseSession): EpisodeRecord[] {
  void session;
  return [];
}

export function listSequenceRecords(session: DatabaseSession): SequenceRecord[] {
  return session.db
    .select()
    .from(sequences)
    .orderBy(asc(sequences.position))
    .all()
    .map((row) => ({
      ...row,
      episodeId: null,
      shortTitle: null,
      oneLineSummary: row.purpose,
    }));
}

export function listSceneRecords(session: DatabaseSession): SceneRecord[] {
  return session.db
    .select()
    .from(scenes)
    .orderBy(asc(scenes.position))
    .all()
    .map((row) => ({
      ...row,
      oneLineSummary: parseFirstString(row.storyFunction),
    }));
}

export function listClipRecords(session: DatabaseSession): ClipRecord[] {
  return session.db
    .select()
    .from(scenes)
    .orderBy(asc(scenes.position))
    .all()
    .map((scene) => ({
      id: scene.id,
      sceneId: scene.id,
      title: scene.title,
      oneLineSummary: parseFirstString(scene.storyFunction),
      position: 0,
    }));
}

export function readClipRecord(
  session: DatabaseSession,
  clipId: string
): ClipRecord | null {
  const scene = session.db.select().from(scenes).where(eq(scenes.id, clipId)).get();
  return scene
    ? {
        id: scene.id,
        sceneId: scene.id,
        title: scene.title,
        oneLineSummary: parseFirstString(scene.storyFunction),
        position: 0,
      }
    : null;
}

function parseFirstString(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
}

function ensureAct(session: DatabaseSession, actId: string): void {
  const existing = session.db.select({ id: acts.id }).from(acts).where(eq(acts.id, actId)).get();
  if (existing) {
    return;
  }
  session.db.insert(acts).values({
    id: actId,
    title: 'Act I',
    purpose: null,
    keyBeats: null,
    position: 0,
  }).run();
}
