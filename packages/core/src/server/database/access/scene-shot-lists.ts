import { and, desc, eq } from 'drizzle-orm';
import type {
  SceneShot,
  SceneShotListDocument,
  SceneShotListSummary,
  SceneShotWithLegacyShotSpecs,
} from '../../../client/scene-shot-list.js';
import type { ScreenplayDocument } from '../../../client/screenplay.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  sceneShotLists,
  sceneShotListState,
  sceneShotStoryboardImages,
} from '../../schema/index.js';
import {
  parseStoredSceneShotListDocument,
  serializeSceneShotListDocument,
} from '../../scene-shot-list-json/validator.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotListRecord = typeof sceneShotLists.$inferSelect;
export type SceneShotListStateRecord = typeof sceneShotListState.$inferSelect;
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
  baseShotListId?: string | null;
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

/**
 * Update an existing shot list's stored document in place (0036). Unlike
 * {@link writeSceneShotListRecord}, this mutates the active row rather than
 * inserting a new history row, matching the debounced-autosave contract for
 * direct UI tuning of shot specs fields.
 */
export function updateSceneShotListRecordDocument(input: {
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
    .update(sceneShotLists)
    .set({
      title: input.document.title,
      document,
      updatedAt: input.now,
    })
    .where(eq(sceneShotLists.id, input.id))
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

export function insertSceneShotStoryboardImageRecord(
  session: DatabaseSession,
  input: {
    id: string;
    sceneId: string;
    shotListId: string;
    shotId: string;
    assetId: string;
    assetFileId: string;
    sourcePurpose: string;
    shotContentFingerprint: string;
    now: string;
  }
): SceneShotStoryboardImageRecord {
  session.db
    .insert(sceneShotStoryboardImages)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      shotId: input.shotId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      sourcePurpose: input.sourcePurpose,
      shotContentFingerprint: input.shotContentFingerprint,
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

export function listSceneShotStoryboardImageRecords(
  session: DatabaseSession,
  input: { shotListId: string }
): SceneShotStoryboardImageRecord[] {
  return session.db
    .select()
    .from(sceneShotStoryboardImages)
    .where(eq(sceneShotStoryboardImages.shotListId, input.shotListId))
    .orderBy(
      desc(sceneShotStoryboardImages.createdAt),
      desc(sceneShotStoryboardImages.id)
    )
    .all();
}

export function readSceneShotStoryboardImageByAssetId(
  session: DatabaseSession,
  assetId: string
): SceneShotStoryboardImageRecord | null {
  return (
    session.db
      .select()
      .from(sceneShotStoryboardImages)
      .where(eq(sceneShotStoryboardImages.assetId, assetId))
      .get() ?? null
  );
}

export function deleteSceneShotStoryboardImageByAssetId(
  session: DatabaseSession,
  assetId: string
): void {
  session.db
    .delete(sceneShotStoryboardImages)
    .where(eq(sceneShotStoryboardImages.assetId, assetId))
    .run();
}

export function readLatestSceneShotStoryboardImage(input: {
  session: DatabaseSession;
  shotListId: string;
  shotId: string;
}): SceneShotStoryboardImageRecord | null {
  return (
    input.session.db
      .select()
      .from(sceneShotStoryboardImages)
      .where(
        and(
          eq(sceneShotStoryboardImages.shotListId, input.shotListId),
          eq(sceneShotStoryboardImages.shotId, input.shotId)
        )
      )
      .orderBy(
        desc(sceneShotStoryboardImages.createdAt),
        desc(sceneShotStoryboardImages.id)
      )
      .get() ?? null
  );
}

export function shotContentFingerprint(shot: SceneShot): string {
  return JSON.stringify({
    title: shot.title,
    storyBeat: shot.storyBeat,
    narrativePurpose: shot.narrativePurpose,
    description: shot.description,
    shotType: shot.shotType,
    cameraAngle: shot.cameraAngle ?? null,
    cameraMovement: shot.cameraMovement ?? null,
    framing: shot.framing ?? null,
    lensIntent: shot.lensIntent ?? null,
    aspectRatio: shot.aspectRatio ?? null,
    subject: shot.subject,
    action: shot.action,
    dialogue: shot.dialogue,
    coveredBlockIndexes: shot.coveredBlockIndexes,
    castMemberIds: shot.castMemberIds,
    locationIds: shot.locationIds,
    audioNotes: shot.audioNotes ?? null,
    productionNotes: shot.productionNotes ?? null,
    shotSpecs: (shot as SceneShotWithLegacyShotSpecs).shotSpecs ?? null,
  });
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
    baseShotListId: readBaseShotListId(document),
  };
}

function readBaseShotListId(
  document: SceneShotListDocument
): string | null | undefined {
  const value = (document as unknown as { baseShotListId?: unknown })
    .baseShotListId;
  return typeof value === 'string' ? value : null;
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
