import { asc } from 'drizzle-orm';
import { continuityReferences } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ContinuityReferenceRecord = typeof continuityReferences.$inferSelect;

export interface InsertContinuityReferenceRecord {
  id: string;
  kind: string;
  name: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertContinuityReferenceRecords(
  session: DatabaseSession,
  records: InsertContinuityReferenceRecord[]
): void {
  for (const record of records) {
    session.db.insert(continuityReferences).values(record).run();
  }
}

export function listContinuityReferenceRecords(
  session: DatabaseSession
): ContinuityReferenceRecord[] {
  return session.db
    .select()
    .from(continuityReferences)
    .orderBy(asc(continuityReferences.position))
    .all();
}
