import { count, eq, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { ProjectCounts } from '../../../client/index.js';
import {
  castMembers,
  locations,
  projectLocales,
  props,
  scenes,
  screenplaySections,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function readProjectCounts(session: DatabaseSession): ProjectCounts {
  return {
    languages: countTable(session, projectLocales),
    castMembers: countTable(session, castMembers),
    locations: countTable(session, locations),
    props: countTable(session, props),
    acts: countTableWhere(session, screenplaySections, eq(screenplaySections.sectionType, 'act')),
    sequences: countTableWhere(session, screenplaySections, eq(screenplaySections.sectionType, 'sequence')),
    scenes: countTable(session, scenes),
  };
}

function countTableWhere(
  session: DatabaseSession,
  table: SQLiteTable,
  condition: SQL<unknown>,
): number {
  const row = session.db.select({ value: count() }).from(table).where(condition).get();
  return row?.value ?? 0;
}

function countTable(session: DatabaseSession, table: SQLiteTable): number {
  const row = session.db.select({ value: count() }).from(table).get();
  return row?.value ?? 0;
}
