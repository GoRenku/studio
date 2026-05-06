import { asc } from 'drizzle-orm';
import { castMembers } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type CastMemberRecord = typeof castMembers.$inferSelect;

export interface InsertCastMemberRecord {
  id: string;
  name: string;
  kind?: string;
  role?: string;
  shortDescription?: string;
  position: number;
}

export function insertCastMemberRecords(
  session: ProjectDataSession,
  records: InsertCastMemberRecord[]
): void {
  for (const record of records) {
    session.db.insert(castMembers).values(record).run();
  }
}

export function listCastMemberRecords(session: ProjectDataSession): CastMemberRecord[] {
  return session.db
    .select()
    .from(castMembers)
    .orderBy(asc(castMembers.position))
    .all();
}
