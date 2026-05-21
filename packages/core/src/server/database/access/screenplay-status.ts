import { count } from 'drizzle-orm';
import { acts, blocks, castMembers, locations, scenes, screenplay, sequences } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export interface ScreenplayStatusCounts {
  castMembers: number;
  locations: number;
  acts: number;
  sequences: number;
  scenes: number;
  blocks: number;
}

export function hasScreenplayRecord(session: DatabaseSession): boolean {
  return (session.db.select().from(screenplay).get() ?? null) !== null;
}

export function readScreenplayStatusCounts(session: DatabaseSession): ScreenplayStatusCounts {
  return {
    castMembers: tableCount(session, castMembers),
    locations: tableCount(session, locations),
    acts: tableCount(session, acts),
    sequences: tableCount(session, sequences),
    scenes: tableCount(session, scenes),
    blocks: tableCount(session, blocks),
  };
}

function tableCount(
  session: DatabaseSession,
  table: typeof acts | typeof blocks | typeof castMembers | typeof locations | typeof scenes | typeof screenplay | typeof sequences
): number {
  return session.db.select({ value: count() }).from(table).get()?.value ?? 0;
}
