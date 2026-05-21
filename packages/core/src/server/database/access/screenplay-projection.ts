import { asc } from 'drizzle-orm';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../../project-data-error.js';
import { validateScreenplayStoredJsonFragment } from '../../screenplay-json/validator.js';
import { scenes, sequences } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SequenceRecord = typeof sequences.$inferSelect & {
  shortTitle: string | null;
  oneLineSummary: string | null;
};

export type SceneRecord = typeof scenes.$inferSelect & {
  oneLineSummary: string | null;
};

export function listSequenceRecords(session: DatabaseSession): SequenceRecord[] {
  return session.db
    .select()
    .from(sequences)
    .orderBy(asc(sequences.position))
    .all()
    .map((row) => ({
      ...row,
      shortTitle: null,
      oneLineSummary: row.purpose,
    }));
}

export function listSceneRecords(session: DatabaseSession): SceneRecord[] {
  return session.db
    .select()
    .from(scenes)
    .orderBy(asc(scenes.position))
    .all()
    .map((row) => ({
      ...row,
      oneLineSummary: parseFirstString(row.storyFunction, [
        'scenes',
        row.id,
        'storyFunction',
      ]),
    }));
}

function parseFirstString(value: string | null, path: string[]): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    validateScreenplayStoredJsonFragment({
      value: parsed,
      fragment: 'stringArray',
      path,
    });
    return (parsed as string[])[0] ?? null;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new ProjectDataError('PROJECT_DATA200', 'Stored screenplay summary JSON is malformed.', {
      issues: [
        createDiagnosticError(
          'PROJECT_DATA200',
          'Stored screenplay summary JSON is malformed.',
          { path },
          'Repair the stored screenplay data before reading navigation.'
        ),
      ],
      suggestion: 'Repair the stored screenplay data before reading navigation.',
    });
  }
}
