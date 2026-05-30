import { asc, desc, eq } from 'drizzle-orm';
import type {
  SceneShotListDocument,
  SceneShotListSummary,
} from '../../../client/scene-shot-list.js';
import type { ScreenplayDocument } from '../../../client/screenplay.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  sceneShotLists,
  sceneShotListState,
  sceneShotStoryboardImages,
  sceneShotStoryboardSheets,
} from '../../schema/index.js';
import {
  parseStoredSceneShotListDocument,
  serializeSceneShotListDocument,
} from '../../scene-shot-list-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotListRecord = typeof sceneShotLists.$inferSelect;
export type SceneShotListStateRecord = typeof sceneShotListState.$inferSelect;
export type SceneShotStoryboardSheetRecord =
  typeof sceneShotStoryboardSheets.$inferSelect;
export type SceneShotStoryboardImageRecord =
  typeof sceneShotStoryboardImages.$inferSelect;

export function listSceneShotListRecords(input: {
  session: DatabaseSession;
  sceneId: string;
  screenplay: ScreenplayDocument;
}): SceneShotListSummary[] {
  const activeShotListId = readActiveSceneShotListId(
    input.session,
    input.sceneId
  );
  return input.session.db
    .select()
    .from(sceneShotLists)
    .where(eq(sceneShotLists.sceneId, input.sceneId))
    .orderBy(desc(sceneShotLists.updatedAt), desc(sceneShotLists.id))
    .all()
    .map((row) =>
      toSceneShotListSummary({
        row,
        screenplay: input.screenplay,
        activeShotListId,
      })
    );
}

export function readSceneShotListRecord(
  session: DatabaseSession,
  shotListId: string
): SceneShotListRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotLists)
      .where(eq(sceneShotLists.id, shotListId))
      .get() ?? null
  );
}

export function requireSceneShotListRecord(
  session: DatabaseSession,
  shotListId: string
): SceneShotListRecord {
  const row = readSceneShotListRecord(session, shotListId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA321',
      `Scene Shot List was not found: ${shotListId}.`,
      {
        suggestion:
          'Use a shot list id from `renku screenplay shot-list list --scene <scene-id> --json`.',
      }
    );
  }
  return row;
}

export function writeSceneShotListRecord(input: {
  session: DatabaseSession;
  id: string;
  document: SceneShotListDocument;
  screenplay: ScreenplayDocument;
  now: string;
  filePath?: string;
}): SceneShotListRecord {
  const document = serializeSceneShotListDocument({
    document: input.document,
    screenplay: input.screenplay,
    filePath: input.filePath,
  });
  input.session.db
    .insert(sceneShotLists)
    .values({
      id: input.id,
      sceneId: input.document.sceneId,
      title: input.document.title,
      document,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  return requireSceneShotListRecord(input.session, input.id);
}

export function readSceneShotListDocument(input: {
  row: SceneShotListRecord;
  screenplay: ScreenplayDocument;
}): SceneShotListDocument {
  return parseStoredSceneShotListDocument({
    value: input.row.document,
    screenplay: input.screenplay,
    path: ['sceneShotList', input.row.id, 'document'],
  });
}

export function readSceneShotListStateRecord(
  session: DatabaseSession,
  sceneId: string
): SceneShotListStateRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotListState)
      .where(eq(sceneShotListState.sceneId, sceneId))
      .get() ?? null
  );
}

export function readActiveSceneShotListId(
  session: DatabaseSession,
  sceneId: string
): string | null {
  return readSceneShotListStateRecord(session, sceneId)?.activeShotListId ?? null;
}

export function readActiveSceneShotListRecord(
  session: DatabaseSession,
  sceneId: string
): SceneShotListRecord | null {
  const activeShotListId = readActiveSceneShotListId(session, sceneId);
  return activeShotListId
    ? readSceneShotListRecord(session, activeShotListId)
    : null;
}

export function setActiveSceneShotListRecord(
  session: DatabaseSession,
  input: { sceneId: string; shotListId: string; now: string }
): void {
  const shotList = requireSceneShotListRecord(session, input.shotListId);
  if (shotList.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'PROJECT_DATA322',
      'Scene Shot List does not belong to the requested scene.',
      {
        suggestion:
          'Use a shot list id from the same scene, or pass the correct --scene value.',
      }
    );
  }
  const existing = readSceneShotListStateRecord(session, input.sceneId);
  if (existing) {
    session.db
      .update(sceneShotListState)
      .set({
        activeShotListId: input.shotListId,
        updatedAt: input.now,
      })
      .where(eq(sceneShotListState.sceneId, input.sceneId))
      .run();
    return;
  }
  session.db
    .insert(sceneShotListState)
    .values({
      sceneId: input.sceneId,
      activeShotListId: input.shotListId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function insertSceneShotStoryboardSheetRecord(
  session: DatabaseSession,
  input: {
    id: string;
    shotListId: string;
    assetId: string;
    sheetFileId: string;
    now: string;
  }
): SceneShotStoryboardSheetRecord {
  session.db
    .insert(sceneShotStoryboardSheets)
    .values({
      id: input.id,
      shotListId: input.shotListId,
      assetId: input.assetId,
      sheetFileId: input.sheetFileId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const sheet = readSceneShotStoryboardSheetRecord(session, input.id);
  if (!sheet) {
    throw new ProjectDataError(
      'PROJECT_DATA323',
      `Scene storyboard sheet was not found after insert: ${input.id}.`
    );
  }
  return sheet;
}

export function insertSceneShotStoryboardImageRecord(
  session: DatabaseSession,
  input: {
    id: string;
    storyboardSheetId: string;
    shotId: string;
    assetFileId: string;
    position: number;
    now: string;
  }
): SceneShotStoryboardImageRecord {
  session.db
    .insert(sceneShotStoryboardImages)
    .values({
      id: input.id,
      storyboardSheetId: input.storyboardSheetId,
      shotId: input.shotId,
      assetFileId: input.assetFileId,
      position: input.position,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const image = readSceneShotStoryboardImageRecord(session, input.id);
  if (!image) {
    throw new ProjectDataError(
      'PROJECT_DATA324',
      `Scene storyboard image was not found after insert: ${input.id}.`
    );
  }
  return image;
}

export function readSceneShotStoryboardSheetRecord(
  session: DatabaseSession,
  id: string
): SceneShotStoryboardSheetRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotStoryboardSheets)
      .where(eq(sceneShotStoryboardSheets.id, id))
      .get() ?? null
  );
}

export function readSceneShotStoryboardImageRecord(
  session: DatabaseSession,
  id: string
): SceneShotStoryboardImageRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotStoryboardImages)
      .where(eq(sceneShotStoryboardImages.id, id))
      .get() ?? null
  );
}

export function listSceneShotStoryboardSheetRecords(
  session: DatabaseSession,
  shotListId: string
): SceneShotStoryboardSheetRecord[] {
  return session.db
    .select()
    .from(sceneShotStoryboardSheets)
    .where(eq(sceneShotStoryboardSheets.shotListId, shotListId))
    .orderBy(
      desc(sceneShotStoryboardSheets.createdAt),
      desc(sceneShotStoryboardSheets.id)
    )
    .all();
}

export function listSceneShotStoryboardImageRecords(
  session: DatabaseSession,
  storyboardSheetId: string
): SceneShotStoryboardImageRecord[] {
  return session.db
    .select()
    .from(sceneShotStoryboardImages)
    .where(eq(sceneShotStoryboardImages.storyboardSheetId, storyboardSheetId))
    .orderBy(asc(sceneShotStoryboardImages.position), asc(sceneShotStoryboardImages.id))
    .all();
}

export function readSceneShotStoryboardSheetByAssetId(
  session: DatabaseSession,
  assetId: string
): SceneShotStoryboardSheetRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotStoryboardSheets)
      .where(eq(sceneShotStoryboardSheets.assetId, assetId))
      .get() ?? null
  );
}

export function deleteSceneShotStoryboardSheetByAssetId(
  session: DatabaseSession,
  assetId: string
): void {
  const sheet = readSceneShotStoryboardSheetByAssetId(session, assetId);
  if (!sheet) {
    return;
  }
  session.db
    .delete(sceneShotStoryboardImages)
    .where(eq(sceneShotStoryboardImages.storyboardSheetId, sheet.id))
    .run();
  session.db
    .delete(sceneShotStoryboardSheets)
    .where(eq(sceneShotStoryboardSheets.id, sheet.id))
    .run();
}

export function assertShotIdsExistInShotList(input: {
  shotList: SceneShotListDocument;
  shotIds: string[];
}): void {
  const validShotIds = new Set(input.shotList.shots.map((shot) => shot.shotId));
  const missing = input.shotIds.find((shotId) => !validShotIds.has(shotId));
  if (missing) {
    throw new ProjectDataError(
      'PROJECT_DATA325',
      `Storyboard import references a shot id that is not in the Scene Shot List: ${missing}.`,
      {
        suggestion:
          'Use shot ids from `renku screenplay shot-list show --shot-list <id> --json`.',
      }
    );
  }
}

export function toSceneShotListSummary(input: {
  row: SceneShotListRecord;
  screenplay: ScreenplayDocument;
  activeShotListId?: string | null;
}): SceneShotListSummary {
  const document = readSceneShotListDocument({
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
    isActive: input.activeShotListId === input.row.id,
  };
}

export function requireSceneShotListForScene(input: {
  session: DatabaseSession;
  shotListId: string;
  sceneId: string;
}): SceneShotListRecord {
  const row = requireSceneShotListRecord(input.session, input.shotListId);
  if (row.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'PROJECT_DATA322',
      'Scene Shot List does not belong to the requested scene.',
      {
        suggestion:
          'Use a shot list id from the same scene, or pass the correct --scene value.',
      }
    );
  }
  return row;
}
