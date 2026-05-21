import { asc, eq } from 'drizzle-orm';
import { castMembers } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface CastMemberRecord {
  id: string;
  handle: string;
  name: string;
  role: string | null;
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
