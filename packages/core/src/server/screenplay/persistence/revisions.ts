import { desc, eq } from 'drizzle-orm';
import type {
  Screenplay,
  ScreenplayRevisionSummary,
} from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { screenplayRevisions } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { assertValidScreenplaySchema } from '../validation/blocks.js';

export function insertScreenplayRevision(input: {
  session: DatabaseSession;
  id: string;
  screenplay: Screenplay;
  sourceCommand: string;
  summary?: string;
  createdAt: string;
}): void {
  assertValidScreenplaySchema(input.screenplay, 'Screenplay revision write');
  input.session.db.insert(screenplayRevisions).values({
    id: input.id,
    screenplayJson: JSON.stringify(input.screenplay),
    sourceCommand: input.sourceCommand,
    summary: input.summary ?? null,
    createdAt: input.createdAt,
  }).run();
}

export function listScreenplayRevisionSummaries(
  session: DatabaseSession,
): ScreenplayRevisionSummary[] {
  return session.db
    .select()
    .from(screenplayRevisions)
    .orderBy(desc(screenplayRevisions.createdAt), desc(screenplayRevisions.id))
    .all()
    .map(toSummary);
}

export function readScreenplayRevision(input: {
  session: DatabaseSession;
  revisionId: string;
}): { revision: ScreenplayRevisionSummary; screenplay: Screenplay } {
  const row = input.session.db
    .select()
    .from(screenplayRevisions)
    .where(eq(screenplayRevisions.id, input.revisionId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'SCREENPLAY_STRUCTURE_ENTRY_NOT_FOUND',
      `Screenplay Revision ${input.revisionId} does not exist.`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(row.screenplayJson);
  } catch {
    throw new ProjectDataError(
      'SCREENPLAY_INVALID_CONTENT',
      `Stored Screenplay Revision ${input.revisionId} is not valid JSON.`,
    );
  }
  assertValidScreenplaySchema(value, `Screenplay Revision ${input.revisionId}`);
  return { revision: toSummary(row), screenplay: value };
}

type RevisionRow = typeof screenplayRevisions.$inferSelect;

function toSummary(row: RevisionRow): ScreenplayRevisionSummary {
  return {
    id: row.id,
    sourceCommand: row.sourceCommand,
    summary: row.summary,
    createdAt: row.createdAt,
  };
}
