import { asc } from 'drizzle-orm';
import { visualLanguage } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type VisualLanguageRecord = typeof visualLanguage.$inferSelect;

export interface InsertVisualLanguageRecord {
  id: string;
  name: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertVisualLanguageRecords(
  session: ProjectDataSession,
  records: InsertVisualLanguageRecord[]
): void {
  for (const record of records) {
    session.db.insert(visualLanguage).values(record).run();
  }
}

export function listVisualLanguageRecords(
  session: ProjectDataSession
): VisualLanguageRecord[] {
  return session.db
    .select()
    .from(visualLanguage)
    .orderBy(asc(visualLanguage.position))
    .all();
}
