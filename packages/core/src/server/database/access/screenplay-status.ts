import { count } from 'drizzle-orm';
import { acts, castMembers, locations, scenes, screenplay, sequences } from '../../schema/index.js';
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
    blocks: session.db
      .select()
      .from(scenes)
      .all()
      .reduce((total, scene) => total + parseBlockCount(scene.blocksJson), 0),
  };
}

function tableCount(
  session: DatabaseSession,
  table: typeof acts | typeof castMembers | typeof locations | typeof scenes | typeof screenplay | typeof sequences
): number {
  return session.db.select({ value: count() }).from(table).get()?.value ?? 0;
}

function parseBlockCount(value: string): number {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}
