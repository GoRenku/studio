import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { castLooks, castLookScenes } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export interface CastLookRecord {
  id: string;
  castMemberId: string;
  name: string;
  description: string | null;
  position: number;
  sceneIds: string[];
}

export function listCastLookRecords(session: DatabaseSession, castMemberId: string): CastLookRecord[] {
  const rows = session.db
    .select()
    .from(castLooks)
    .where(eq(castLooks.castMemberId, castMemberId))
    .orderBy(asc(castLooks.position), asc(castLooks.id))
    .all();
  const scenesByLook = lookSceneIds(session, rows.map((row) => row.id));
  return rows.map((row) => toRecord(row, scenesByLook.get(row.id) ?? []));
}

export function readCastLookRecord(session: DatabaseSession, lookId: string): CastLookRecord | null {
  const row = session.db.select().from(castLooks).where(eq(castLooks.id, lookId)).get();
  return row ? toRecord(row, lookSceneIds(session, [row.id]).get(row.id) ?? []) : null;
}

/** The Look a Cast Member has in one scene, or null when no Look covers it. */
export function readSceneLookRecord(
  session: DatabaseSession,
  input: { castMemberId: string; sceneId: string }
): CastLookRecord | null {
  const row = session.db
    .select({ lookId: castLookScenes.castLookId })
    .from(castLookScenes)
    .where(and(eq(castLookScenes.castMemberId, input.castMemberId), eq(castLookScenes.sceneId, input.sceneId)))
    .get();
  return row ? readCastLookRecord(session, row.lookId) : null;
}

/**
 * Replaces a Cast Member's Looks and their scenes. Looks absent from `looks`
 * are deleted; the caller has already checked that nothing depends on them.
 * Runs inside the caller's transaction.
 */
export function replaceCastLookRecords(
  session: DatabaseSession,
  input: { castMemberId: string; looks: CastLookRecord[]; now: string }
): void {
  const keptIds = input.looks.map((look) => look.id);
  session.db.delete(castLookScenes).where(eq(castLookScenes.castMemberId, input.castMemberId)).run();
  session.db
    .delete(castLooks)
    .where(and(eq(castLooks.castMemberId, input.castMemberId), notInArray(castLooks.id, keptIds)))
    .run();
  const existing = new Set(
    session.db.select({ id: castLooks.id }).from(castLooks).where(eq(castLooks.castMemberId, input.castMemberId)).all()
      .map((row) => row.id)
  );
  // Clear names first so a rename that swaps two Looks never trips the unique name index.
  input.looks.filter((look) => existing.has(look.id)).forEach((look) => {
    session.db.update(castLooks).set({ name: `${look.id}:renaming` }).where(eq(castLooks.id, look.id)).run();
  });
  input.looks.forEach((look) => {
    const values = { name: look.name, description: look.description, position: look.position, updatedAt: input.now };
    if (existing.has(look.id)) {
      session.db.update(castLooks).set(values).where(eq(castLooks.id, look.id)).run();
    } else {
      session.db.insert(castLooks).values({ ...values, id: look.id, castMemberId: input.castMemberId, createdAt: input.now }).run();
    }
  });
  const sceneRows = input.looks.flatMap((look) =>
    look.sceneIds.map((sceneId) => ({ castMemberId: input.castMemberId, castLookId: look.id, sceneId })));
  if (sceneRows.length > 0) {
    session.db.insert(castLookScenes).values(sceneRows).run();
  }
}

/** Adds one Look at the end of a Cast Member's Looks. Runs inside the caller's transaction. */
export function insertCastLookRecord(
  session: DatabaseSession,
  input: { look: Omit<CastLookRecord, 'position'>; now: string }
): void {
  const position = listCastLookRecords(session, input.look.castMemberId).length;
  session.db.insert(castLooks).values({
    id: input.look.id,
    castMemberId: input.look.castMemberId,
    name: input.look.name,
    description: input.look.description,
    position,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
  if (input.look.sceneIds.length > 0) {
    session.db.insert(castLookScenes).values(
      input.look.sceneIds.map((sceneId) => ({ castMemberId: input.look.castMemberId, castLookId: input.look.id, sceneId }))
    ).run();
  }
}

export function countCastLookRecords(session: DatabaseSession, castMemberId: string): number {
  return session.db.select({ id: castLooks.id }).from(castLooks).where(eq(castLooks.castMemberId, castMemberId)).all().length;
}

function lookSceneIds(session: DatabaseSession, lookIds: string[]): Map<string, string[]> {
  const scenes = new Map<string, string[]>();
  if (lookIds.length === 0) {
    return scenes;
  }
  session.db
    .select()
    .from(castLookScenes)
    .where(inArray(castLookScenes.castLookId, lookIds))
    .all()
    .forEach((row) => scenes.set(row.castLookId, [...(scenes.get(row.castLookId) ?? []), row.sceneId]));
  return scenes;
}

function toRecord(row: typeof castLooks.$inferSelect, sceneIds: string[]): CastLookRecord {
  return {
    id: row.id,
    castMemberId: row.castMemberId,
    name: row.name,
    description: row.description,
    position: row.position,
    sceneIds,
  };
}
