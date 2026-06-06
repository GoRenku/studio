import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  ProjectRelativePath,
  SceneShotVideoTake,
  ShotVideoTakeAvailableInput,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '../../../client/index.js';
import {
  assets,
  assetFiles,
  sceneShotVideoTakeInputShots,
  sceneShotVideoTakeInputs,
  sceneShotVideoTakeShots,
  sceneShotVideoTakes,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotVideoTakeInputRecord =
  typeof sceneShotVideoTakeInputs.$inferSelect;
export type SceneShotVideoTakeRecord = typeof sceneShotVideoTakes.$inferSelect;

export interface InsertShotVideoTakeInputRecord {
  id: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  inputKind: ShotVideoTakeInputKind;
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId?: string | null;
  selection: 'select' | 'take';
  shotIds: string[];
  now: string;
}

export interface InsertShotVideoTakeRecord {
  id: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId?: string | null;
  shotIds: string[];
  isSelected: boolean;
  now: string;
}

export function insertShotVideoTakeInputRecord(
  session: DatabaseSession,
  input: InsertShotVideoTakeInputRecord
): ShotVideoTakeAvailableInput {
  if (input.selection === 'select') {
    setMatchingInputRecordsToTake(session, input);
  }
  session.db
    .insert(sceneShotVideoTakeInputs)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      productionGroupId: input.productionGroupId,
      inputKind: input.inputKind,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      mediaGenerationRunId: input.mediaGenerationRunId ?? null,
      selection: input.selection,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  input.shotIds.forEach((shotId, shotOrder) => {
    session.db
      .insert(sceneShotVideoTakeInputShots)
      .values({ inputId: input.id, shotId, shotOrder })
      .run();
  });
  return requireShotVideoTakeInput(session, input.id);
}

export function listShotVideoTakeInputs(
  session: DatabaseSession,
  input: {
    sceneId: string;
    shotListId: string;
    productionGroupId: string;
    shotIds?: string[];
  }
): ShotVideoTakeAvailableInput[] {
  const rows = session.db
    .select({
      input: sceneShotVideoTakeInputs,
      title: assets.title,
      mediaKind: assetFiles.mediaKind,
      projectRelativePath: assetFiles.projectRelativePath,
    })
    .from(sceneShotVideoTakeInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeInputs.assetId, assets.id))
    .where(
      and(
        eq(sceneShotVideoTakeInputs.sceneId, input.sceneId),
        eq(sceneShotVideoTakeInputs.shotListId, input.shotListId),
        eq(sceneShotVideoTakeInputs.productionGroupId, input.productionGroupId)
      )
    )
    .orderBy(
      desc(sceneShotVideoTakeInputs.createdAt),
      desc(sceneShotVideoTakeInputs.id)
    )
    .all()
    .map((row) =>
      toAvailableInput(
        session,
        row.input,
        row.title,
        row.mediaKind,
        row.projectRelativePath
      )
    );
  if (!input.shotIds) {
    return rows;
  }
  return rows.filter((row) => sameShotIds(row.shotIds, input.shotIds ?? []));
}

export function requireShotVideoTakeInput(
  session: DatabaseSession,
  inputId: string
): ShotVideoTakeAvailableInput {
  const row = session.db
    .select({
      input: sceneShotVideoTakeInputs,
      title: assets.title,
      mediaKind: assetFiles.mediaKind,
      projectRelativePath: assetFiles.projectRelativePath,
    })
    .from(sceneShotVideoTakeInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeInputs.assetId, assets.id))
    .where(eq(sceneShotVideoTakeInputs.id, inputId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA360',
      `Shot video take input was not found: ${inputId}.`
    );
  }
  return toAvailableInput(
    session,
    row.input,
    row.title,
    row.mediaKind,
    row.projectRelativePath
  );
}

export function selectShotVideoTakeInputRecord(
  session: DatabaseSession,
  input: { inputId: string; now: string }
): ShotVideoTakeAvailableInput {
  const selected = requireShotVideoTakeInputRecord(session, input.inputId);
  setMatchingInputRecordsToTake(session, {
    sceneId: selected.sceneId,
    shotListId: selected.shotListId,
    productionGroupId: selected.productionGroupId,
    inputKind: selected.inputKind as ShotVideoTakeInputKind,
    subjectKind: selected.subjectKind as ShotVideoTakeInputSubjectKind,
    subjectId: selected.subjectId,
  });
  session.db
    .update(sceneShotVideoTakeInputs)
    .set({ selection: 'select', updatedAt: input.now })
    .where(eq(sceneShotVideoTakeInputs.id, input.inputId))
    .run();
  return requireShotVideoTakeInput(session, input.inputId);
}

export function clearShotVideoTakeInputRecordSelection(
  session: DatabaseSession,
  input: {
    sceneId: string;
    shotListId: string;
    productionGroupId: string;
    inputKind: ShotVideoTakeInputKind;
    subjectKind: ShotVideoTakeInputSubjectKind;
    subjectId: string;
    now: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakeInputs)
    .set({ selection: 'take', updatedAt: input.now })
    .where(
      and(
        eq(sceneShotVideoTakeInputs.sceneId, input.sceneId),
        eq(sceneShotVideoTakeInputs.shotListId, input.shotListId),
        eq(sceneShotVideoTakeInputs.productionGroupId, input.productionGroupId),
        eq(sceneShotVideoTakeInputs.inputKind, input.inputKind),
        eq(sceneShotVideoTakeInputs.subjectKind, input.subjectKind),
        eq(sceneShotVideoTakeInputs.subjectId, input.subjectId)
      )
    )
    .run();
}

export function deleteShotVideoTakeInputRecord(
  session: DatabaseSession,
  inputId: string
): void {
  const row = requireShotVideoTakeInputRecord(session, inputId);
  session.db
    .delete(sceneShotVideoTakeInputShots)
    .where(eq(sceneShotVideoTakeInputShots.inputId, inputId))
    .run();
  session.db
    .delete(sceneShotVideoTakeInputs)
    .where(eq(sceneShotVideoTakeInputs.id, inputId))
    .run();
  session.db.delete(assetFiles).where(eq(assetFiles.assetId, row.assetId)).run();
  session.db.delete(assets).where(eq(assets.id, row.assetId)).run();
}

export function insertShotVideoTakeRecord(
  session: DatabaseSession,
  input: InsertShotVideoTakeRecord
): SceneShotVideoTake {
  if (input.isSelected) {
    clearSelectedTakesForGroup(session, input);
  }
  session.db
    .insert(sceneShotVideoTakes)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      productionGroupId: input.productionGroupId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      mediaGenerationRunId: input.mediaGenerationRunId ?? null,
      createdAt: input.now,
      updatedAt: input.now,
      isSelected: input.isSelected,
    })
    .run();
  input.shotIds.forEach((shotId, shotOrder) => {
    session.db
      .insert(sceneShotVideoTakeShots)
      .values({ takeId: input.id, shotId, shotOrder })
      .run();
  });
  return requireShotVideoTake(session, input.id);
}

export function listShotVideoTakes(
  session: DatabaseSession,
  input: { sceneId: string; shotListId: string; productionGroupId: string }
): SceneShotVideoTake[] {
  return session.db
    .select()
    .from(sceneShotVideoTakes)
    .where(
      and(
        eq(sceneShotVideoTakes.sceneId, input.sceneId),
        eq(sceneShotVideoTakes.shotListId, input.shotListId),
        eq(sceneShotVideoTakes.productionGroupId, input.productionGroupId)
      )
    )
    .orderBy(desc(sceneShotVideoTakes.createdAt), desc(sceneShotVideoTakes.id))
    .all()
    .map((row) => toVideoTake(session, row));
}

export function requireShotVideoTake(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTake {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakes)
      .where(eq(sceneShotVideoTakes.id, takeId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA361',
      `Shot video take was not found: ${takeId}.`
    );
  }
  return toVideoTake(session, row);
}

function requireShotVideoTakeInputRecord(
  session: DatabaseSession,
  inputId: string
): SceneShotVideoTakeInputRecord {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakeInputs)
      .where(eq(sceneShotVideoTakeInputs.id, inputId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA360',
      `Shot video take input was not found: ${inputId}.`
    );
  }
  return row;
}

function setMatchingInputRecordsToTake(
  session: DatabaseSession,
  input: {
    sceneId: string;
    shotListId: string;
    productionGroupId: string;
    inputKind: ShotVideoTakeInputKind;
    subjectKind: ShotVideoTakeInputSubjectKind;
    subjectId: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakeInputs)
    .set({ selection: 'take' })
    .where(
      and(
        eq(sceneShotVideoTakeInputs.sceneId, input.sceneId),
        eq(sceneShotVideoTakeInputs.shotListId, input.shotListId),
        eq(sceneShotVideoTakeInputs.productionGroupId, input.productionGroupId),
        eq(sceneShotVideoTakeInputs.inputKind, input.inputKind),
        eq(sceneShotVideoTakeInputs.subjectKind, input.subjectKind),
        eq(sceneShotVideoTakeInputs.subjectId, input.subjectId)
      )
    )
    .run();
}

function clearSelectedTakesForGroup(
  session: DatabaseSession,
  input: { sceneId: string; shotListId: string; productionGroupId: string; now: string }
): void {
  session.db
    .update(sceneShotVideoTakes)
    .set({ isSelected: false, updatedAt: input.now })
    .where(
      and(
        eq(sceneShotVideoTakes.sceneId, input.sceneId),
        eq(sceneShotVideoTakes.shotListId, input.shotListId),
        eq(sceneShotVideoTakes.productionGroupId, input.productionGroupId)
      )
    )
    .run();
}

function toAvailableInput(
  session: DatabaseSession,
  row: SceneShotVideoTakeInputRecord,
  title: string,
  mediaKind: string,
  projectRelativePath: string
): ShotVideoTakeAvailableInput {
  return {
    inputId: row.id,
    kind: row.inputKind as ShotVideoTakeInputKind,
    title,
    assetId: row.assetId,
    assetFileId: row.assetFileId,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    mediaKind: mediaKind as 'image' | 'audio' | 'video',
    subjectKind: row.subjectKind as ShotVideoTakeInputSubjectKind,
    subjectId: row.subjectId,
    productionGroupId: row.productionGroupId,
    shotIds: listInputShotIds(session, row.id),
    ...(row.mediaGenerationRunId
      ? { mediaGenerationRunId: row.mediaGenerationRunId }
      : {}),
    selected: row.selection === 'select',
    createdAt: row.createdAt,
  };
}

function toVideoTake(
  session: DatabaseSession,
  row: SceneShotVideoTakeRecord
): SceneShotVideoTake {
  return {
    takeId: row.id,
    assetId: row.assetId,
    assetFileId: row.assetFileId,
    ...(row.mediaGenerationRunId
      ? { mediaGenerationRunId: row.mediaGenerationRunId }
      : {}),
    shotIds: listTakeShotIds(session, row.id),
    selected: row.isSelected,
    createdAt: row.createdAt,
  };
}

function listInputShotIds(session: DatabaseSession, inputId: string): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeInputShots)
    .where(eq(sceneShotVideoTakeInputShots.inputId, inputId))
    .orderBy(asc(sceneShotVideoTakeInputShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

function listTakeShotIds(session: DatabaseSession, takeId: string): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeShots)
    .where(eq(sceneShotVideoTakeShots.takeId, takeId))
    .orderBy(asc(sceneShotVideoTakeShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

function sameShotIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((shotId, index) => shotId === right[index]);
}
