import { asc, eq, notInArray } from 'drizzle-orm';
import { projectLocales } from '../../../schema/index.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export type ProjectLocaleRecord = typeof projectLocales.$inferSelect;

export interface InsertProjectLocaleRecord {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
  position: number;
}

export function insertProjectLocaleRecords(
  session: ProjectDataSession,
  records: InsertProjectLocaleRecord[]
): void {
  for (const record of records) {
    session.db.insert(projectLocales).values(record).run();
  }
}

export function listProjectLocaleRecords(
  session: ProjectDataSession
): ProjectLocaleRecord[] {
  return session.db
    .select()
    .from(projectLocales)
    .orderBy(asc(projectLocales.position))
    .all();
}

export function replaceProjectLocaleRecords(
  session: ProjectDataSession,
  records: InsertProjectLocaleRecord[]
): void {
  const existingIds = new Set(listProjectLocaleRecords(session).map((record) => record.id));
  for (const record of records) {
    if (existingIds.has(record.id)) {
      session.db
        .update(projectLocales)
        .set(record)
        .where(eq(projectLocales.id, record.id))
        .run();
    } else {
      session.db.insert(projectLocales).values(record).run();
    }
  }

  const ids = records.map((record) => record.id);
  if (ids.length === 0) {
    session.db.delete(projectLocales).run();
    return;
  }
  session.db.delete(projectLocales).where(notInArray(projectLocales.id, ids)).run();
}
