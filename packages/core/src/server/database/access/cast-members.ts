import { asc, eq, notInArray } from 'drizzle-orm';
import {
  castAssets,
  castDesigns,
  castDesignState,
  castMembers,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface CastMemberRecord {
  id: string;
  handle: string;
  name: string;
  role: string | null;
  isVoiceOver: boolean;
  age: number | null;
  want: string | null;
  need: string | null;
  arc: string | null;
  voiceNotes: string | null;
  description: string | null;
  position: number;
  kind: string;
  shortDescription: string | null;
}

export interface InsertCastMemberRecord {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  isVoiceOver?: boolean;
  shortDescription?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertCastMemberRecords(
  session: DatabaseSession,
  records: InsertCastMemberRecord[]
): void {
  for (const record of records) {
    session.db.insert(castMembers).values({
      id: record.id,
      handle: toHandle(record.name, record.id),
      name: record.name,
      role: record.role ?? null,
      isVoiceOver: record.isVoiceOver ?? false,
      description: record.shortDescription ?? null,
      position: record.position,
    }).run();
  }
}

function toHandle(name: string, id: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(normalized) ? normalized : `cast-${id.replace(/[^a-z0-9]+/gi, '').toLowerCase()}`;
}

export function listCastMemberRecords(session: DatabaseSession): CastMemberRecord[] {
  return session.db
    .select()
    .from(castMembers)
    .orderBy(asc(castMembers.position))
    .all()
    .map((row) => ({
      ...row,
      kind: row.role ?? 'character',
      shortDescription: row.description,
    }));
}

export function readCastMemberRecord(
  session: DatabaseSession,
  castMemberId: string
): CastMemberRecord | null {
  const row =
    session.db
      .select()
      .from(castMembers)
      .where(eq(castMembers.id, castMemberId))
      .get() ?? null;
  return row ? { ...row, kind: row.role ?? 'character', shortDescription: row.description } : null;
}

export interface CastMemberAuthoringRecord {
  id: string;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver?: boolean;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}

export interface CastMemberDeleteDependencySummary {
  assetCount: number;
  designCount: number;
  activeDesignStateCount: number;
}

export function replaceCastMemberAuthoringRecords(
  session: DatabaseSession,
  records: CastMemberAuthoringRecord[]
): void {
  records.forEach((record, position) => {
    const values = {
      id: record.id,
      handle: record.handle,
      name: record.name,
      role: record.role ?? null,
      isVoiceOver: record.isVoiceOver ?? false,
      age: record.age ?? null,
      want: record.want ?? null,
      need: record.need ?? null,
      arc: record.arc ?? null,
      voiceNotes: record.voiceNotes ?? null,
      description: record.description ?? null,
      position,
    };
    const existing = session.db
      .select({ id: castMembers.id })
      .from(castMembers)
      .where(eq(castMembers.id, record.id))
      .get();
    if (existing) {
      session.db.update(castMembers).set(values).where(eq(castMembers.id, record.id)).run();
    } else {
      session.db.insert(castMembers).values(values).run();
    }
  });

  const ids = records.map((record) => record.id);
  if (ids.length === 0) {
    session.db.delete(castMembers).run();
    return;
  }
  session.db.delete(castMembers).where(notInArray(castMembers.id, ids)).run();
}

export function updateCastMemberVoiceOverRecord(
  session: DatabaseSession,
  input: { castMemberId: string; isVoiceOver: boolean }
): boolean {
  const result = session.db
    .update(castMembers)
    .set({ isVoiceOver: input.isVoiceOver })
    .where(eq(castMembers.id, input.castMemberId))
    .run();
  return result.changes > 0;
}

export function listCastAssetRoleSelectionRecords(
  session: DatabaseSession,
  castMemberId: string
): Array<{ role: string; selection: string }> {
  return session.db
    .select({ role: castAssets.role, selection: castAssets.selection })
    .from(castAssets)
    .where(eq(castAssets.castMemberId, castMemberId))
    .all();
}

export function readCastMemberDeleteDependencySummary(
  session: DatabaseSession,
  castMemberId: string
): CastMemberDeleteDependencySummary {
  return {
    assetCount: session.db
      .select({ id: castAssets.id })
      .from(castAssets)
      .where(eq(castAssets.castMemberId, castMemberId))
      .all().length,
    designCount: session.db
      .select({ id: castDesigns.id })
      .from(castDesigns)
      .where(eq(castDesigns.castMemberId, castMemberId))
      .all().length,
    activeDesignStateCount: session.db
      .select({ castMemberId: castDesignState.castMemberId })
      .from(castDesignState)
      .where(eq(castDesignState.castMemberId, castMemberId))
      .all().length,
  };
}
