import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type {
  ProjectRelativePath,
  SceneShotVideoTakeState,
  SceneShotVideoTakeMediaInput,
  SceneShotVideoTakeVideo,
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
} from '../../../client/index.js';
import {
  assets,
  assetFileGenerations,
  assetFiles,
  sceneShotVideoTakeMediaInputShots,
  sceneShotVideoTakeMediaInputs,
  sceneShotVideoTakes,
  sceneShotVideoTakeVideos,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  parseSceneShotVideoTakeState,
} from '../../shot-video-take-json/validator.js';
import {
  sceneShotVideoTakeStructureDirections,
} from '../../media-generation/purposes/shot-video-take/persistence/take-state.js';
import {
  sceneShotVideoTakeDirectionReferenceSelections,
} from '../../media-generation/purposes/shot-video-take/shared/take-state-projections.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotVideoTakeInputRecord =
  typeof sceneShotVideoTakeMediaInputs.$inferSelect;
export type SceneShotVideoTakeVideoRecord =
  typeof sceneShotVideoTakeVideos.$inferSelect;

export interface ActiveShotVideoTakeInputAssetRecord {
  inputId: string;
  sceneId: string;
  takeId: string;
  inputKind: string;
  subjectKind: string;
  subjectId: string;
  assetId: string;
  assetFileId: string;
  selection: string;
  assetDiscardedAt: string | null;
  assetFileDiscardedAt: string | null;
  createdAt: string;
}

export interface InsertShotVideoTakeInputRecord {
  id: string;
  sceneId: string;
  takeId: string;
  inputKind: ShotVideoTakeInputKind;
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  assetId: string;
  assetFileId: string;
  selection: 'select' | 'take';
  shotIds: string[];
  now: string;
}

export interface InsertShotVideoTakeVideoRecord {
  takeId: string;
  assetId: string;
  assetFileId: string;
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
      mediaGenerationRunId: assetFileGenerations.mediaGenerationRunId,
    })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeMediaInputs.assetId, assets.id))
    .leftJoin(
      assetFileGenerations,
      eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFileGenerations.assetFileId),
    )
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
        row.projectRelativePath,
        row.mediaGenerationRunId,
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
      mediaGenerationRunId: assetFileGenerations.mediaGenerationRunId,
    })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeMediaInputs.assetId, assets.id))
    .leftJoin(
      assetFileGenerations,
      eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFileGenerations.assetFileId),
    )
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
    row.projectRelativePath,
    row.mediaGenerationRunId,
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
  const video = session.db
    .select({ takeId: sceneShotVideoTakeVideos.takeId })
    .from(sceneShotVideoTakeVideos)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeVideos.takeId, sceneShotVideoTakes.id)
    )
    .where(
      and(
        eq(sceneShotVideoTakeVideos.assetId, assetId),
        isNull(sceneShotVideoTakeVideos.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt)
      )
    )
    .get();
  if (video) {
    throw takeAssetReferenceError(assetId, [
      'sceneShotVideoTakeVideo',
      video.takeId,
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

export function insertShotVideoTakeVideoRecord(
  session: DatabaseSession,
  input: InsertShotVideoTakeVideoRecord
): SceneShotVideoTakeVideo {
  session.db
    .insert(sceneShotVideoTakeVideos)
    .values({
      takeId: input.takeId,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  return requireShotVideoTakeVideo(session, input.takeId);
}

export function readShotVideoTakeVideo(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTakeVideo | null {
  const row = session.db
    .select({
      video: sceneShotVideoTakeVideos,
      projectRelativePath: assetFiles.projectRelativePath,
      mimeType: assetFiles.mimeType,
      mediaGenerationRunId: assetFileGenerations.mediaGenerationRunId,
    })
    .from(sceneShotVideoTakeVideos)
    .innerJoin(assetFiles, eq(sceneShotVideoTakeVideos.assetFileId, assetFiles.id))
    .innerJoin(assets, eq(sceneShotVideoTakeVideos.assetId, assets.id))
    .leftJoin(
      assetFileGenerations,
      eq(sceneShotVideoTakeVideos.assetFileId, assetFileGenerations.assetFileId),
    )
    .where(
      and(
        eq(sceneShotVideoTakeVideos.takeId, takeId),
        isNull(sceneShotVideoTakeVideos.discardedAt),
        isNull(assetFiles.discardedAt),
        isNull(assets.discardedAt)
      )
    )
    .get();
  return row
    ? toVideoTake(
        row.video,
        row.projectRelativePath,
        row.mimeType,
        row.mediaGenerationRunId,
      )
    : null;
}

export function requireShotVideoTakeVideo(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTakeVideo {
  const video = readShotVideoTakeVideo(session, takeId);
  if (!video) {
    throw new ProjectDataError(
      'PROJECT_DATA361',
      `Shot video take video was not found for take: ${takeId}.`
    );
  }
  return video;
}

export function requireShotVideoTakeInputRecord(
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

export function updateShotVideoTakeInputAssetRecord(
  session: DatabaseSession,
  input: {
    inputId: string;
    assetId: string;
    assetFileId: string;
    now: string;
  }
): void {
  session.db
    .update(sceneShotVideoTakeMediaInputs)
    .set({
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakeMediaInputs.id, input.inputId))
    .run();
}

export function listActiveShotVideoTakeInputAssetRecords(
  session: DatabaseSession
): ActiveShotVideoTakeInputAssetRecord[] {
  return session.db
    .select({
      inputId: sceneShotVideoTakeMediaInputs.id,
      sceneId: sceneShotVideoTakeMediaInputs.sceneId,
      takeId: sceneShotVideoTakeMediaInputs.takeId,
      inputKind: sceneShotVideoTakeMediaInputs.inputKind,
      subjectKind: sceneShotVideoTakeMediaInputs.subjectKind,
      subjectId: sceneShotVideoTakeMediaInputs.subjectId,
      assetId: sceneShotVideoTakeMediaInputs.assetId,
      assetFileId: sceneShotVideoTakeMediaInputs.assetFileId,
      selection: sceneShotVideoTakeMediaInputs.selection,
      assetDiscardedAt: assets.discardedAt,
      assetFileDiscardedAt: assetFiles.discardedAt,
      createdAt: sceneShotVideoTakeMediaInputs.createdAt,
    })
    .from(sceneShotVideoTakeMediaInputs)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeMediaInputs.takeId, sceneShotVideoTakes.id)
    )
    .innerJoin(assets, eq(sceneShotVideoTakeMediaInputs.assetId, assets.id))
    .innerJoin(
      assetFiles,
      eq(sceneShotVideoTakeMediaInputs.assetFileId, assetFiles.id)
    )
    .where(
      and(
        isNull(sceneShotVideoTakeMediaInputs.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt)
      )
    )
    .all();
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

function toAvailableInput(
  session: DatabaseSession,
  row: SceneShotVideoTakeInputRecord,
  title: string,
  mediaKind: string,
  projectRelativePath: string,
  mediaGenerationRunId: string | null,
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
    ...(mediaGenerationRunId
      ? { mediaGenerationRunId }
      : {}),
    selected: row.selection === 'select',
    createdAt: row.createdAt,
  };
}

function toVideoTake(
  row: SceneShotVideoTakeVideoRecord,
  projectRelativePath: string,
  mimeType: string | null,
  mediaGenerationRunId: string | null,
): SceneShotVideoTakeVideo {
  return {
    takeId: row.takeId,
    assetId: row.assetId,
    assetFileId: row.assetFileId,
    ...(mediaGenerationRunId
      ? { mediaGenerationRunId }
      : {}),
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    mimeType,
    createdAt: row.createdAt,
  };
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
