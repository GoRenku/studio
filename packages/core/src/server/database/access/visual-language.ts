import { asc } from 'drizzle-orm';
import { visualLanguage } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type VisualLanguageRecord = typeof visualLanguage.$inferSelect;

export interface InsertVisualLanguageRecord {
  id: string;
  categoryId: string;
  name: string;
  oneLineSummary?: string;
  priority: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertVisualLanguageRecords(
  session: DatabaseSession,
  records: InsertVisualLanguageRecord[]
): void {
  for (const record of records) {
    session.db.insert(visualLanguage).values(record).run();
  }
}

export function listVisualLanguageRecords(
  session: DatabaseSession
): VisualLanguageRecord[] {
  return session.db
    .select()
    .from(visualLanguage)
    .orderBy(asc(visualLanguage.position))
    .all();
}
