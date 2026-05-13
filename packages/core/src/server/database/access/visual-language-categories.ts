import { asc } from 'drizzle-orm';
import { visualLanguageCategories } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type VisualLanguageCategoryRecord =
  typeof visualLanguageCategories.$inferSelect;

export interface InsertVisualLanguageCategoryRecord {
  id: string;
  name: string;
  description?: string;
  source: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertVisualLanguageCategoryRecords(
  session: DatabaseSession,
  records: InsertVisualLanguageCategoryRecord[]
): void {
  for (const record of records) {
    session.db.insert(visualLanguageCategories).values(record).run();
  }
}

export function listVisualLanguageCategoryRecords(
  session: DatabaseSession
): VisualLanguageCategoryRecord[] {
  return session.db
    .select()
    .from(visualLanguageCategories)
    .orderBy(asc(visualLanguageCategories.position))
    .all();
}
