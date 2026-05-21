import { count } from 'drizzle-orm';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { Block } from '../../../client/screenplay.js';
import { acts, castMembers, locations, scenes, screenplay, sequences } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { validateScreenplayStoredJsonFragment } from '../../screenplay-json/validator.js';
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
      .reduce(
        (total, scene) => total + parseBlockCount(scene.blocksJson, ['scenes', scene.id, 'blocks']),
        0
      ),
  };
}

function tableCount(
  session: DatabaseSession,
  table: typeof acts | typeof castMembers | typeof locations | typeof scenes | typeof screenplay | typeof sequences
): number {
  return session.db.select({ value: count() }).from(table).get()?.value ?? 0;
}

function parseBlockCount(value: string, path: string[]): number {
  try {
    const parsed = JSON.parse(value) as unknown;
    validateScreenplayStoredJsonFragment({
      value: parsed,
      fragment: 'blockArray',
      path,
    });
    return (parsed as Block[]).length;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new ProjectDataError('PROJECT_DATA200', 'Stored screenplay block JSON is malformed.', {
      issues: [
        createDiagnosticError(
          'PROJECT_DATA200',
          'Stored screenplay block JSON is malformed.',
          { path },
          'Repair the stored screenplay data before reading status.'
        ),
      ],
      suggestion: 'Repair the stored screenplay data before reading status.',
    });
  }
}
