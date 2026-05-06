import { asc } from 'drizzle-orm';
import { projectLanguages } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type ProjectLanguageRecord = typeof projectLanguages.$inferSelect;

export interface InsertProjectLanguageRecord {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  position: number;
}

export function insertProjectLanguageRecords(
  session: ProjectDataSession,
  records: InsertProjectLanguageRecord[]
): void {
  for (const record of records) {
    session.db.insert(projectLanguages).values(record).run();
  }
}

export function listProjectLanguageRecords(
  session: ProjectDataSession
): ProjectLanguageRecord[] {
  return session.db
    .select()
    .from(projectLanguages)
    .orderBy(asc(projectLanguages.position))
    .all();
}
