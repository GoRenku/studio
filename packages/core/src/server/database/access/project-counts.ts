import { count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { ProjectCounts } from '../../../client/index.js';
import {
  castMembers,
  clips,
  continuityReferences,
  episodes,
  projectLocales,
  scenes,
  sequences,
  visualLanguage,
  visualLanguageCategories,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function readProjectCounts(session: DatabaseSession): ProjectCounts {
  return {
    languages: countTable(session, projectLocales),
    visualLanguageCategories: countTable(session, visualLanguageCategories),
    visualLanguage: countTable(session, visualLanguage),
    castMembers: countTable(session, castMembers),
    continuityReferences: countTable(session, continuityReferences),
    episodes: countTable(session, episodes),
    sequences: countTable(session, sequences),
    scenes: countTable(session, scenes),
    clips: countTable(session, clips),
  };
}

function countTable(session: DatabaseSession, table: SQLiteTable): number {
  const row = session.db.select({ value: count() }).from(table).get();
  return row?.value ?? 0;
}
