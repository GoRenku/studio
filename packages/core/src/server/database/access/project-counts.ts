import { count } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { ProjectCounts } from '../../../client/index.js';
import {
  castMembers,
  acts,
  locations,
  projectLocales,
  scenes,
  sequences,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function readProjectCounts(session: DatabaseSession): ProjectCounts {
  return {
    languages: countTable(session, projectLocales),
    castMembers: countTable(session, castMembers),
    locations: countTable(session, locations),
    acts: countTable(session, acts),
    sequences: countTable(session, sequences),
    scenes: countTable(session, scenes),
  };
}

function countTable(session: DatabaseSession, table: SQLiteTable): number {
  const row = session.db.select({ value: count() }).from(table).get();
  return row?.value ?? 0;
}
