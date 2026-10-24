import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { castCostumes, castCostumeScenes } from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';
import { parseStoredCastingTextList } from './stored-json.js';

export interface CastCostumeRecord {
  id: string;
  castMemberId: string;
  lookId: string;
  name: string;
  wardrobe: string[];
  continuityNotes: string[];
  position: number;
  sceneIds: string[];
}

export function listCastCostumeRecords(session: DatabaseSession, castMemberId: string): CastCostumeRecord[] {
  const rows = session.db
    .select()
    .from(castCostumes)
    .where(eq(castCostumes.castMemberId, castMemberId))
    .orderBy(asc(castCostumes.position), asc(castCostumes.id))
    .all();
  const scenesByCostume = costumeSceneIds(session, rows.map((row) => row.id));
  return rows.map((row) => toRecord(row, scenesByCostume.get(row.id) ?? []));
}

export function readCastCostumeRecord(session: DatabaseSession, costumeId: string): CastCostumeRecord | null {
  const row = session.db.select().from(castCostumes).where(eq(castCostumes.id, costumeId)).get();
  return row ? toRecord(row, costumeSceneIds(session, [row.id]).get(row.id) ?? []) : null;
}

/** The costume a Cast Member wears in one scene, or null when the wardrobe plan has none. */
export function readSceneCostumeRecord(
  session: DatabaseSession,
  input: { castMemberId: string; sceneId: string }
): CastCostumeRecord | null {
  const row = session.db
    .select({ costumeId: castCostumeScenes.castCostumeId })
    .from(castCostumeScenes)
    .where(and(eq(castCostumeScenes.castMemberId, input.castMemberId), eq(castCostumeScenes.sceneId, input.sceneId)))
    .get();
  return row ? readCastCostumeRecord(session, row.costumeId) : null;
}

export function countCastCostumeRecordsForLook(session: DatabaseSession, lookId: string): number {
  return session.db.select({ id: castCostumes.id }).from(castCostumes).where(eq(castCostumes.castLookId, lookId)).all().length;
}

/**
 * Replaces a Cast Member's costumes and their scenes. Costumes absent from
 * `costumes` are deleted. Runs inside the caller's transaction.
 */
export function replaceCastCostumeRecords(
  session: DatabaseSession,
  input: { castMemberId: string; costumes: CastCostumeRecord[]; now: string }
): void {
  const keptIds = input.costumes.map((costume) => costume.id);
  session.db.delete(castCostumeScenes).where(eq(castCostumeScenes.castMemberId, input.castMemberId)).run();
  session.db
    .delete(castCostumes)
    .where(and(eq(castCostumes.castMemberId, input.castMemberId), notInArray(castCostumes.id, keptIds)))
    .run();
  const existing = new Set(
    session.db.select({ id: castCostumes.id }).from(castCostumes).where(eq(castCostumes.castMemberId, input.castMemberId)).all()
      .map((row) => row.id)
  );
  // Clear names first so a rename that swaps two costumes never trips the unique name index.
  input.costumes.filter((costume) => existing.has(costume.id)).forEach((costume) => {
    session.db.update(castCostumes).set({ name: `${costume.id}:renaming` }).where(eq(castCostumes.id, costume.id)).run();
  });
  input.costumes.forEach((costume) => {
    const values = {
      castLookId: costume.lookId,
      name: costume.name,
      wardrobeJson: JSON.stringify(costume.wardrobe),
      continuityNotesJson: JSON.stringify(costume.continuityNotes),
      position: costume.position,
      updatedAt: input.now,
    };
    if (existing.has(costume.id)) {
      session.db.update(castCostumes).set(values).where(eq(castCostumes.id, costume.id)).run();
    } else {
      session.db.insert(castCostumes).values({ ...values, id: costume.id, castMemberId: input.castMemberId, createdAt: input.now }).run();
    }
  });
  const sceneRows = input.costumes.flatMap((costume) =>
    costume.sceneIds.map((sceneId) => ({ castMemberId: input.castMemberId, castCostumeId: costume.id, sceneId })));
  if (sceneRows.length > 0) {
    session.db.insert(castCostumeScenes).values(sceneRows).run();
  }
}

function costumeSceneIds(session: DatabaseSession, costumeIds: string[]): Map<string, string[]> {
  const scenes = new Map<string, string[]>();
  if (costumeIds.length === 0) {
    return scenes;
  }
  session.db
    .select()
    .from(castCostumeScenes)
    .where(inArray(castCostumeScenes.castCostumeId, costumeIds))
    .all()
    .forEach((row) => scenes.set(row.castCostumeId, [...(scenes.get(row.castCostumeId) ?? []), row.sceneId]));
  return scenes;
}

function toRecord(row: typeof castCostumes.$inferSelect, sceneIds: string[]): CastCostumeRecord {
  const location = ['castCostume', row.id];
  return {
    id: row.id,
    castMemberId: row.castMemberId,
    lookId: row.castLookId,
    name: row.name,
    wardrobe: parseStoredCastingTextList(row.wardrobeJson, [...location, 'wardrobe']),
    continuityNotes: parseStoredCastingTextList(row.continuityNotesJson, [...location, 'continuityNotes']),
    position: row.position,
    sceneIds,
  };
}
