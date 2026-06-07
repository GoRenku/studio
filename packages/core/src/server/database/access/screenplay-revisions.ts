import { desc, eq } from 'drizzle-orm';
import type {
  ScreenplayDocument,
  ScreenplayRevisionSummary,
} from '../../../client/screenplay.js';
import { ProjectDataError } from '../../project-data-error.js';
import { screenplayRevisions } from '../../schema/index.js';
import { validateScreenplayJsonDocument } from '../../screenplay-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ScreenplayRevisionRecord =
  typeof screenplayRevisions.$inferSelect;

export function insertScreenplayRevisionRecord(input: {
  session: DatabaseSession;
  id: string;
  document: ScreenplayDocument;
  sourceCommand: string;
  summary?: string | null;
  now: string;
}): ScreenplayRevisionRecord {
  input.session.db
    .insert(screenplayRevisions)
    .values({
      id: input.id,
      screenplayDocument: serializeScreenplayRevisionDocument(input.document),
      sourceCommand: input.sourceCommand,
      summary: input.summary ?? null,
      createdAt: input.now,
    })
    .run();
  return requireScreenplayRevisionRecord(input.session, input.id);
}

export function listScreenplayRevisionRecords(
  session: DatabaseSession
): ScreenplayRevisionSummary[] {
  return session.db
    .select()
    .from(screenplayRevisions)
    .orderBy(desc(screenplayRevisions.createdAt), desc(screenplayRevisions.id))
    .all()
    .map(toScreenplayRevisionSummary);
}

export function requireScreenplayRevisionRecord(
  session: DatabaseSession,
  revisionId: string
): ScreenplayRevisionRecord {
  const row =
    session.db
      .select()
      .from(screenplayRevisions)
      .where(eq(screenplayRevisions.id, revisionId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA230',
      `Screenplay revision was not found: ${revisionId}.`,
      {
        suggestion:
          'Use a revision id from `renku screenplay revision list --json`.',
      }
    );
  }
  return row;
}

export function readScreenplayRevisionDocument(
  row: ScreenplayRevisionRecord
): ScreenplayDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.screenplayDocument);
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA231',
      `Stored screenplay revision JSON is malformed: ${row.id}.`
    );
  }
  validateScreenplayJsonDocument({
    value: parsed,
    kind: 'screenplay',
  });
  return parsed as ScreenplayDocument;
}

export function toScreenplayRevisionSummary(
  row: ScreenplayRevisionRecord
): ScreenplayRevisionSummary {
  return {
    id: row.id,
    sourceCommand: row.sourceCommand,
    summary: row.summary,
    createdAt: row.createdAt,
  };
}

function serializeScreenplayRevisionDocument(
  document: ScreenplayDocument
): string {
  validateScreenplayJsonDocument({ value: document, kind: 'screenplay' });
  return JSON.stringify(document);
}
