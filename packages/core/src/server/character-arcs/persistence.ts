import { asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { CharacterArcDocument } from '../../client/character-arcs/model.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { castMembers } from '../schema/index.js';
import { parseStoredCharacterArc } from './validation.js';

export interface StoredCharacterArcRecord {
  castMemberId: string;
  name: string;
  role: string | null;
  writtenAt: string;
  arc: CharacterArcDocument;
}

/** The only reader of `cast_member.character_arc`. */
export function listStoredCharacterArcs(session: DatabaseSession): StoredCharacterArcRecord[] {
  return session.db
    .select({ id: castMembers.id, name: castMembers.name, role: castMembers.role, characterArc: castMembers.characterArc })
    .from(castMembers)
    .where(isNotNull(castMembers.characterArc))
    .orderBy(asc(castMembers.position), asc(castMembers.id))
    .all()
    .map((row) => toStoredRecord(row));
}

export function readStoredCharacterArc(
  session: DatabaseSession,
  castMemberId: string
): StoredCharacterArcRecord | null {
  const row = session.db
    .select({ id: castMembers.id, name: castMembers.name, role: castMembers.role, characterArc: castMembers.characterArc })
    .from(castMembers)
    .where(eq(castMembers.id, castMemberId))
    .get();
  return row?.characterArc ? toStoredRecord(row) : null;
}

/**
 * Replaces the complete set of arcs: listed Cast Members get their arc, every
 * other Cast Member that had one is cleared. Runs inside the caller's
 * transaction.
 */
export function replaceStoredCharacterArcs(
  session: DatabaseSession,
  input: { arcs: Array<{ castMemberId: string; arc: CharacterArcDocument }>; writtenAt: string }
): { written: string[]; cleared: string[] } {
  const listed = new Set(input.arcs.map((entry) => entry.castMemberId));
  const cleared = session.db
    .select({ id: castMembers.id })
    .from(castMembers)
    .where(isNotNull(castMembers.characterArc))
    .all()
    .map((row) => row.id)
    .filter((id) => !listed.has(id));
  if (cleared.length > 0) {
    session.db.update(castMembers).set({ characterArc: null }).where(inArray(castMembers.id, cleared)).run();
  }
  for (const entry of input.arcs) {
    session.db
      .update(castMembers)
      .set({ characterArc: JSON.stringify({ writtenAt: input.writtenAt, arc: entry.arc }) })
      .where(eq(castMembers.id, entry.castMemberId))
      .run();
  }
  return { written: input.arcs.map((entry) => entry.castMemberId), cleared };
}

/** Cast Members whose arc is a reference to the given owner's arc. */
export function listCastMembersSharingCharacterArc(
  session: DatabaseSession,
  ownerCastMemberId: string
): StoredCharacterArcRecord[] {
  return listStoredCharacterArcs(session).filter(
    (record) => record.arc.kind === 'characterArcReference' && record.arc.castMemberId === ownerCastMemberId
  );
}

function toStoredRecord(row: { id: string; name: string; role: string | null; characterArc: string | null }): StoredCharacterArcRecord {
  const stored = parseStoredCharacterArc(row.characterArc as string, row.id);
  return { castMemberId: row.id, name: row.name, role: row.role, writtenAt: stored.writtenAt, arc: stored.arc };
}
