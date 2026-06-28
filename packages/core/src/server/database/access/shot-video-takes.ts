import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type {
  ProjectRelativePath,
  SceneShotVideoTakeState,
  SceneShotVideoTakeOutput,
  SceneShotVideoTakeMediaInput,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '../../../client/index.js';
import {
  assets,
  assetFiles,
  sceneShotVideoTakeMediaInputShots,
  sceneShotVideoTakeMediaInputs,
  sceneShotVideoTakes,
  sceneShotVideoTakeOutputShots,
  sceneShotVideoTakeOutputs,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  parseSceneShotVideoTakeState,
} from '../../shot-video-take-json/validator.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
  sceneShotVideoTakeStructureDirections,
} from '../../media-generation/shot-video-take/take-state.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotVideoTakeInputRecord =
  typeof sceneShotVideoTakeMediaInputs.$inferSelect;
export type SceneShotVideoTakeRecord = typeof sceneShotVideoTakeOutputs.$inferSelect;

export interface InsertShotVideoTakeInputRecord {
  id: string;
  sceneId: string;
  takeId: string;
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
  takeId: string;
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
): SceneShotVideoTakeMediaInput {
  if (input.selection === 'select') {
    setMatchingInputRecordsToTake(session, input);
  }
  session.db
    .insert(sceneShotVideoTakeMediaInputs)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      takeId: input.takeId,
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
      .insert(sceneShotVideoTakeMediaInputShots)
      .values({ inputId: input.id, shotId, shotOrder })
      .run();
  });
  return requireShotVideoTakeInput(session, input.id);
}

export function listShotVideoTakeInputs(
  session: DatabaseSession,
  input: {
    sceneId: string;
    takeId: string;
    shotIds?: string[];
  }
): SceneShotVideoTakeMediaInput[] {
  const rows = session.db
    .select({
      input: sceneShotVideoTakeMediaInputs,
      title: assets.title,
      mediaKind: assetFiles.mediaKind,
      projectRelativePath: assetFiles.projectRelativePath,
    })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeMediaInputs.assetId, assets.id))
    .where(
      and(
        eq(sceneShotVideoTakeMediaInputs.sceneId, input.sceneId),
        eq(
          sceneShotVideoTakeMediaInputs.takeId,
          input.takeId
        ),
        isNull(sceneShotVideoTakeMediaInputs.discardedAt),
        isNull(assetFiles.discardedAt),
        isNull(assets.discardedAt)
      )
    )
    .orderBy(
      desc(sceneShotVideoTakeMediaInputs.createdAt),
      desc(sceneShotVideoTakeMediaInputs.id)
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
): SceneShotVideoTakeMediaInput {
  const row = session.db
    .select({
      input: sceneShotVideoTakeMediaInputs,
      title: assets.title,
      mediaKind: assetFiles.mediaKind,
      projectRelativePath: assetFiles.projectRelativePath,
    })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeMediaInputs.assetId, assets.id))
    .where(
      and(
        eq(sceneShotVideoTakeMediaInputs.id, inputId),
        isNull(sceneShotVideoTakeMediaInputs.discardedAt),
        isNull(assetFiles.discardedAt),
        isNull(assets.discardedAt)
      )
    )
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
): SceneShotVideoTakeMediaInput {
  const selected = requireShotVideoTakeInputRecord(session, input.inputId);
  setMatchingInputRecordsToTake(session, {
    sceneId: selected.sceneId,
    takeId: selected.takeId,
    inputKind: selected.inputKind as ShotVideoTakeInputKind,
    subjectKind: selected.subjectKind as ShotVideoTakeInputSubjectKind,
    subjectId: selected.subjectId,
  });
  session.db
    .update(sceneShotVideoTakeMediaInputs)
    .set({ selection: 'select', updatedAt: input.now })
    .where(eq(sceneShotVideoTakeMediaInputs.id, input.inputId))
    .run();
  return requireShotVideoTakeInput(session, input.inputId);
}

export function clearShotVideoTakeInputRecordSelection(
  session: DatabaseSession,
  input: {
    sceneId: string;
    takeId: string;
    inputKind: ShotVideoTakeInputKind;
    subjectKind: ShotVideoTakeInputSubjectKind;
    subjectId: string;
    now: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakeMediaInputs)
    .set({ selection: 'take', updatedAt: input.now })
    .where(
      and(
        eq(sceneShotVideoTakeMediaInputs.sceneId, input.sceneId),
        eq(
          sceneShotVideoTakeMediaInputs.takeId,
          input.takeId
        ),
        eq(sceneShotVideoTakeMediaInputs.inputKind, input.inputKind),
        eq(sceneShotVideoTakeMediaInputs.subjectKind, input.subjectKind),
        eq(sceneShotVideoTakeMediaInputs.subjectId, input.subjectId)
      )
    )
    .run();
}

export function assertAssetNotReferencedByShotVideoTakeRecords(
  session: DatabaseSession,
  assetId: string
): void {
  const mediaInput = session.db
    .select({ id: sceneShotVideoTakeMediaInputs.id })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeMediaInputs.takeId, sceneShotVideoTakes.id)
    )
    .where(
      and(
        eq(sceneShotVideoTakeMediaInputs.assetId, assetId),
        isNull(sceneShotVideoTakeMediaInputs.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt)
      )
    )
    .get();
  if (mediaInput) {
    throw takeAssetReferenceError(assetId, [
      'sceneShotVideoTakeMediaInput',
      mediaInput.id,
    ]);
  }
  const output = session.db
    .select({ id: sceneShotVideoTakeOutputs.id })
    .from(sceneShotVideoTakeOutputs)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeOutputs.takeId, sceneShotVideoTakes.id)
    )
    .where(
      and(
        eq(sceneShotVideoTakeOutputs.assetId, assetId),
        isNull(sceneShotVideoTakeOutputs.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt)
      )
    )
    .get();
  if (output) {
    throw takeAssetReferenceError(assetId, [
      'sceneShotVideoTakeOutput',
      output.id,
    ]);
  }
  for (const row of session.db
    .select({
      id: sceneShotVideoTakes.id,
      stateJson: sceneShotVideoTakes.stateJson,
    })
    .from(sceneShotVideoTakes)
    .where(isNull(sceneShotVideoTakes.discardedAt))
    .all()) {
    const state = parseSceneShotVideoTakeState({ value: row.stateJson });
    if (sceneShotVideoTakeStateReferencesAsset(state, assetId)) {
      throw takeAssetReferenceError(assetId, [
        'sceneShotVideoTake',
        row.id,
        'state',
      ]);
    }
  }
}

export function insertShotVideoTakeRecord(
  session: DatabaseSession,
  input: InsertShotVideoTakeRecord
): SceneShotVideoTakeOutput {
  if (input.isSelected) {
    clearSelectedTakesForGeneration(session, input);
  }
  session.db
    .insert(sceneShotVideoTakeOutputs)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      takeId: input.takeId,
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
      .insert(sceneShotVideoTakeOutputShots)
      .values({ outputId: input.id, shotId, shotOrder })
      .run();
  });
  return requireShotVideoTake(session, input.id);
}

export function listShotVideoTakes(
  session: DatabaseSession,
  input: { sceneId: string; takeId: string }
): SceneShotVideoTakeOutput[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeOutputs)
    .where(
      and(
        eq(sceneShotVideoTakeOutputs.sceneId, input.sceneId),
        eq(sceneShotVideoTakeOutputs.takeId, input.takeId)
      )
    )
    .orderBy(desc(sceneShotVideoTakeOutputs.createdAt), desc(sceneShotVideoTakeOutputs.id))
    .all()
    .map((row) => toVideoTake(session, row));
}

export function requireShotVideoTake(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTakeOutput {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakeOutputs)
      .where(eq(sceneShotVideoTakeOutputs.id, takeId))
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
      .from(sceneShotVideoTakeMediaInputs)
      .where(eq(sceneShotVideoTakeMediaInputs.id, inputId))
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
    takeId: string;
    inputKind: ShotVideoTakeInputKind;
    subjectKind: ShotVideoTakeInputSubjectKind;
    subjectId: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakeMediaInputs)
    .set({ selection: 'take' })
    .where(
      and(
        eq(sceneShotVideoTakeMediaInputs.sceneId, input.sceneId),
        eq(
          sceneShotVideoTakeMediaInputs.takeId,
          input.takeId
        ),
        eq(sceneShotVideoTakeMediaInputs.inputKind, input.inputKind),
        eq(sceneShotVideoTakeMediaInputs.subjectKind, input.subjectKind),
        eq(sceneShotVideoTakeMediaInputs.subjectId, input.subjectId)
      )
    )
    .run();
}

function clearSelectedTakesForGeneration(
  session: DatabaseSession,
  input: { sceneId: string; takeId: string; now: string }
): void {
  session.db
    .update(sceneShotVideoTakeOutputs)
    .set({ isSelected: false, updatedAt: input.now })
    .where(
      and(
        eq(sceneShotVideoTakeOutputs.sceneId, input.sceneId),
        eq(sceneShotVideoTakeOutputs.takeId, input.takeId)
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
): SceneShotVideoTakeMediaInput {
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
    takeId: row.takeId,
    shotIds: listTakeInputShotIds(session, row.id),
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
): SceneShotVideoTakeOutput {
  return {
    outputId: row.id,
    takeId: row.takeId,
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

function listTakeShotIds(session: DatabaseSession, takeId: string): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeOutputShots)
    .where(eq(sceneShotVideoTakeOutputShots.outputId, takeId))
    .orderBy(asc(sceneShotVideoTakeOutputShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

function listTakeInputShotIds(
  session: DatabaseSession,
  inputId: string
): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeMediaInputShots)
    .where(eq(sceneShotVideoTakeMediaInputShots.inputId, inputId))
    .orderBy(asc(sceneShotVideoTakeMediaInputShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

function sameShotIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((shotId, index) => shotId === right[index]);
}

function sceneShotVideoTakeStateReferencesAsset(
  state: SceneShotVideoTakeState,
  assetId: string
): boolean {
  const directions = sceneShotVideoTakeStructureDirections(state.structure);
  const selectedReferenceAssets = directions.flatMap((direction) => [
    ...Object.values(
      sceneShotVideoTakeDirectionReferenceSelections(direction)
        .selectedCharacterSheetAssetIds
    ),
    ...Object.values(
      sceneShotVideoTakeDirectionReferenceSelections(direction)
        .selectedLocationSheetAssetIds
    ).flat(),
  ]);
  if (selectedReferenceAssets.includes(assetId)) {
    return true;
  }
  return directions.some((direction) => {
    const shotReferenceAssets = [
      ...Object.values(direction.cast?.characterSheetAssetIds ?? {}),
      ...(direction.location?.environmentSheetAssetIds ?? []),
      direction.lookbook?.lookbookSheetId,
      ...direction.dialogue?.map((dialogue) => dialogue.assetId) ?? [],
    ].filter((candidate): candidate is string => Boolean(candidate));
    return shotReferenceAssets.includes(assetId);
  });
}

function takeAssetReferenceError(
  assetId: string,
  path: string[]
): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA421',
    `Asset ${assetId} is selected by a Shot Video Take and cannot be deleted.`,
    {
      issues: [
        {
          code: 'PROJECT_DATA421',
          severity: 'error',
          message:
            'The asset is retained because at least one Shot Video Take references it.',
          location: { path },
          suggestion:
            'Clear or replace the take reference before deleting this asset.',
        },
      ],
    }
  );
}
