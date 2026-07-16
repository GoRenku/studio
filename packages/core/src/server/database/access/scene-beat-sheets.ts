import { desc, eq } from 'drizzle-orm';
import type {
  SceneBeatSheetDocument,
  SceneBeatSheetSummary,
} from '../../../client/scene-beat-sheet.js';
import type { ScreenplayDocument } from '../../../client/screenplay.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  sceneBeatSheets,
  sceneBeatSheetState,
} from '../../schema/index.js';
import {
  parseStoredSceneBeatSheetDocument,
  serializeSceneBeatSheetDocument,
} from '../../scene-beat-sheet/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneBeatSheetRecord = typeof sceneBeatSheets.$inferSelect;
export type SceneBeatSheetStateRecord = typeof sceneBeatSheetState.$inferSelect;

export function listSceneBeatSheetRecords(input: {
  session: DatabaseSession;
  sceneId: string;
  screenplay: ScreenplayDocument;
}): SceneBeatSheetSummary[] {
  const activeBeatSheetId = readActiveSceneBeatSheetId(
    input.session,
    input.sceneId
  );
  return input.session.db
    .select()
    .from(sceneBeatSheets)
    .where(eq(sceneBeatSheets.sceneId, input.sceneId))
    .orderBy(desc(sceneBeatSheets.updatedAt), desc(sceneBeatSheets.id))
    .all()
    .map((row) =>
      toSceneBeatSheetSummary({
        row,
        screenplay: input.screenplay,
        activeBeatSheetId,
      })
    );
}

export function readSceneBeatSheetRecord(
  session: DatabaseSession,
  beatSheetId: string
): SceneBeatSheetRecord | null {
  return (
    session.db
      .select()
      .from(sceneBeatSheets)
      .where(eq(sceneBeatSheets.id, beatSheetId))
      .get() ?? null
  );
}

export function requireSceneBeatSheetRecord(
  session: DatabaseSession,
  beatSheetId: string
): SceneBeatSheetRecord {
  const row = readSceneBeatSheetRecord(session, beatSheetId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA321',
      `Scene Beat Sheet was not found: ${beatSheetId}.`,
      {
        suggestion:
          'Use a Beat Sheet id from `renku screenplay beat-sheet list --scene <scene-id> --json`.',
      }
    );
  }
  return row;
}

export function writeSceneBeatSheetRecord(input: {
  session: DatabaseSession;
  id: string;
  document: SceneBeatSheetDocument;
  screenplay: ScreenplayDocument;
  now: string;
  filePath?: string;
  baseBeatSheetId?: string | null;
}): SceneBeatSheetRecord {
  const document = serializeSceneBeatSheetDocument({
    document: input.document,
    screenplay: input.screenplay,
    filePath: input.filePath,
  });
  input.session.db
    .insert(sceneBeatSheets)
    .values({
      id: input.id,
      sceneId: input.document.sceneId,
      title: input.document.title,
      document,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  return requireSceneBeatSheetRecord(input.session, input.id);
}

/**
 * Update an existing Beat Sheet's stored document in place. Unlike
 * {@link writeSceneBeatSheetRecord}, this mutates the active row rather than
 * inserting a new history row.
 */
export function updateSceneBeatSheetRecordDocument(input: {
  session: DatabaseSession;
  id: string;
  document: SceneBeatSheetDocument;
  screenplay: ScreenplayDocument;
  now: string;
  filePath?: string;
}): SceneBeatSheetRecord {
  const document = serializeSceneBeatSheetDocument({
    document: input.document,
    screenplay: input.screenplay,
    filePath: input.filePath,
  });
  input.session.db
    .update(sceneBeatSheets)
    .set({
      title: input.document.title,
      document,
      updatedAt: input.now,
    })
    .where(eq(sceneBeatSheets.id, input.id))
    .run();
  return requireSceneBeatSheetRecord(input.session, input.id);
}

export function readSceneBeatSheetDocument(input: {
  row: SceneBeatSheetRecord;
  screenplay: ScreenplayDocument;
}): SceneBeatSheetDocument {
  return parseStoredSceneBeatSheetDocument({
    value: input.row.document,
    screenplay: input.screenplay,
    path: ['sceneBeatSheet', input.row.id, 'document'],
  });
}

export function readSceneBeatSheetStateRecord(
  session: DatabaseSession,
  sceneId: string
): SceneBeatSheetStateRecord | null {
  return (
    session.db
      .select()
      .from(sceneBeatSheetState)
      .where(eq(sceneBeatSheetState.sceneId, sceneId))
      .get() ?? null
  );
}

export function readActiveSceneBeatSheetId(
  session: DatabaseSession,
  sceneId: string
): string | null {
  return readSceneBeatSheetStateRecord(session, sceneId)?.activeBeatSheetId ?? null;
}

export function readActiveSceneBeatSheetRecord(
  session: DatabaseSession,
  sceneId: string
): SceneBeatSheetRecord | null {
  const activeBeatSheetId = readActiveSceneBeatSheetId(session, sceneId);
  return activeBeatSheetId
    ? readSceneBeatSheetRecord(session, activeBeatSheetId)
    : null;
}

export function setActiveSceneBeatSheetRecord(
  session: DatabaseSession,
  input: { sceneId: string; beatSheetId: string; now: string }
): void {
  const beatSheet = requireSceneBeatSheetRecord(session, input.beatSheetId);
  if (beatSheet.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'PROJECT_DATA322',
      'Scene Beat Sheet does not belong to the requested scene.',
      {
        suggestion:
          'Use a Beat Sheet id from the same scene, or pass the correct --scene value.',
      }
    );
  }
  const existing = readSceneBeatSheetStateRecord(session, input.sceneId);
  if (existing) {
    session.db
      .update(sceneBeatSheetState)
      .set({
        activeBeatSheetId: input.beatSheetId,
        updatedAt: input.now,
      })
      .where(eq(sceneBeatSheetState.sceneId, input.sceneId))
      .run();
    return;
  }
  session.db
    .insert(sceneBeatSheetState)
    .values({
      sceneId: input.sceneId,
      activeBeatSheetId: input.beatSheetId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function toSceneBeatSheetSummary(input: {
  row: SceneBeatSheetRecord;
  screenplay: ScreenplayDocument;
  activeBeatSheetId?: string | null;
}): SceneBeatSheetSummary {
  const document = readSceneBeatSheetDocument({
    row: input.row,
    screenplay: input.screenplay,
  });
  return {
    id: input.row.id,
    sceneId: input.row.sceneId,
    title: document.title,
    summary: document.summary,
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
    isActive: input.activeBeatSheetId === input.row.id,
    baseBeatSheetId: readBaseBeatSheetId(document),
  };
}

function readBaseBeatSheetId(
  document: SceneBeatSheetDocument
): string | null | undefined {
  const value = (document as unknown as { baseBeatSheetId?: unknown })
    .baseBeatSheetId;
  return typeof value === 'string' ? value : null;
}

export function requireSceneBeatSheetForScene(input: {
  session: DatabaseSession;
  beatSheetId: string;
  sceneId: string;
}): SceneBeatSheetRecord {
  const row = requireSceneBeatSheetRecord(input.session, input.beatSheetId);
  if (row.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'PROJECT_DATA322',
      'Scene Beat Sheet does not belong to the requested scene.',
      {
        suggestion:
          'Use a Beat Sheet id from the same scene, or pass the correct --scene value.',
      }
    );
  }
  return row;
}
