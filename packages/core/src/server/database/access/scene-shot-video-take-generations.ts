import { asc, desc, eq } from 'drizzle-orm';
import type {
  SceneShot,
  SceneShotListDocument,
  ShotVideoTakeGenerationProduction,
} from '../../../client/scene-shot-list.js';
import type {
  SceneShotVideoTakeGeneration,
  SceneShotVideoTakeGenerationCompatibility,
  SceneShotVideoTakeGenerationCompatibilitySnapshot,
  SceneShotVideoTakeGenerationIncompatibilityReason,
} from '../../../client/shot-video-take-generation.js';
import {
  parseSceneShotVideoTakeGenerationCompatibilitySnapshot,
  parseShotVideoTakeGenerationProduction,
  serializeSceneShotVideoTakeGenerationCompatibilitySnapshot,
  serializeShotVideoTakeGenerationProduction,
} from '../../shot-video-take-generation-json/validator.js';
import {
  sceneShotVideoTakeGenerationShots,
  sceneShotVideoTakeGenerations,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  readActiveSceneShotListId,
  readLatestSceneShotStoryboardImage,
  readSceneShotListDocument,
  requireSceneShotListForScene,
  requireSceneShotListRecord,
  shotContentFingerprint,
} from './scene-shot-lists.js';
import type { ScreenplayDocument } from '../../../client/screenplay.js';
import {
  carryTakeGenerationProductionForShotMembership,
} from '../../media-generation/shot-video-take/take-generation-production.js';

export type SceneShotVideoTakeGenerationRecord =
  typeof sceneShotVideoTakeGenerations.$inferSelect;

export interface CreateSceneShotVideoTakeGenerationRecordInput {
  id: string;
  sceneId: string;
  shotListId: string;
  title?: string;
  shotIds: string[];
  production?: ShotVideoTakeGenerationProduction;
  screenplay: ScreenplayDocument;
  now: string;
}

export function insertSceneShotVideoTakeGenerationRecord(
  session: DatabaseSession,
  input: CreateSceneShotVideoTakeGenerationRecordInput
): SceneShotVideoTakeGeneration {
  const shotListRow = requireSceneShotListForScene({
    session,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
  });
  const shotList = readSceneShotListDocument({
    row: shotListRow,
    screenplay: input.screenplay,
  });
  const shotIds = normalizeShotIds(shotList.shots, input.shotIds);
  const snapshot = buildSceneShotVideoTakeGenerationCompatibilitySnapshot({
    session,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    shotList,
    shotIds,
  });
  session.db
    .insert(sceneShotVideoTakeGenerations)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      shotListId: input.shotListId,
      title: input.title ?? defaultTakeGenerationTitle(shotIds),
      production: serializeShotVideoTakeGenerationProduction({
        production: input.production ?? {},
      }),
      compatibilitySnapshot:
        serializeSceneShotVideoTakeGenerationCompatibilitySnapshot({
          snapshot,
        }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  insertTakeGenerationShotMembership({
    session,
    takeGenerationId: input.id,
    shotListId: input.shotListId,
    shotList,
    shotIds,
  });
  return requireSceneShotVideoTakeGeneration(session, {
    takeGenerationId: input.id,
    screenplay: input.screenplay,
  });
}

export function requireSceneShotVideoTakeGeneration(
  session: DatabaseSession,
  input: { takeGenerationId: string; screenplay: ScreenplayDocument }
): SceneShotVideoTakeGeneration {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakeGenerations)
      .where(eq(sceneShotVideoTakeGenerations.id, input.takeGenerationId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA419',
      `Scene Shot Video Take Generation was not found: ${input.takeGenerationId}.`
    );
  }
  return toSceneShotVideoTakeGeneration(session, {
    row,
    screenplay: input.screenplay,
  });
}

export function listSceneShotVideoTakeGenerationsForScene(
  session: DatabaseSession,
  input: { sceneId: string; screenplay: ScreenplayDocument }
): SceneShotVideoTakeGeneration[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeGenerations)
    .where(eq(sceneShotVideoTakeGenerations.sceneId, input.sceneId))
    .orderBy(
      desc(sceneShotVideoTakeGenerations.updatedAt),
      desc(sceneShotVideoTakeGenerations.id)
    )
    .all()
    .map((row) =>
      toSceneShotVideoTakeGeneration(session, {
        row,
        screenplay: input.screenplay,
      })
    );
}

export function updateSceneShotVideoTakeGenerationProductionRecord(
  session: DatabaseSession,
  input: {
    takeGenerationId: string;
    production: ShotVideoTakeGenerationProduction;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTakeGeneration {
  session.db
    .update(sceneShotVideoTakeGenerations)
    .set({
      production: serializeShotVideoTakeGenerationProduction({
        production: input.production,
      }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakeGenerations.id, input.takeGenerationId))
    .run();
  return requireSceneShotVideoTakeGeneration(session, {
    takeGenerationId: input.takeGenerationId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeGenerationShotMembershipRecord(
  session: DatabaseSession,
  input: {
    takeGenerationId: string;
    shotIds: string[];
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTakeGeneration {
  const generation = requireSceneShotVideoTakeGeneration(session, {
    takeGenerationId: input.takeGenerationId,
    screenplay: input.screenplay,
  });
  const shotListRow = requireSceneShotListForScene({
    session,
    sceneId: generation.sceneId,
    shotListId: generation.shotListId,
  });
  const shotList = readSceneShotListDocument({
    row: shotListRow,
    screenplay: input.screenplay,
  });
  const shotIds = normalizeShotIds(shotList.shots, input.shotIds);
  const production = carryTakeGenerationProductionForShotMembership({
    production: generation.production,
    previousShotIds: generation.shotIds,
    nextShotIds: shotIds,
  });
  const snapshot = buildSceneShotVideoTakeGenerationCompatibilitySnapshot({
    session,
    sceneId: generation.sceneId,
    shotListId: generation.shotListId,
    shotList,
    shotIds,
  });
  session.db
    .delete(sceneShotVideoTakeGenerationShots)
    .where(
      eq(
        sceneShotVideoTakeGenerationShots.takeGenerationId,
        input.takeGenerationId
      )
    )
    .run();
  insertTakeGenerationShotMembership({
    session,
    takeGenerationId: input.takeGenerationId,
    shotListId: generation.shotListId,
    shotList,
    shotIds,
  });
  session.db
    .update(sceneShotVideoTakeGenerations)
    .set({
      production: serializeShotVideoTakeGenerationProduction({
        production,
      }),
      compatibilitySnapshot:
        serializeSceneShotVideoTakeGenerationCompatibilitySnapshot({
          snapshot,
        }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakeGenerations.id, input.takeGenerationId))
    .run();
  return requireSceneShotVideoTakeGeneration(session, {
    takeGenerationId: input.takeGenerationId,
    screenplay: input.screenplay,
  });
}

export function listSceneShotVideoTakeGenerationShotIds(
  session: DatabaseSession,
  takeGenerationId: string
): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeGenerationShots)
    .where(
      eq(sceneShotVideoTakeGenerationShots.takeGenerationId, takeGenerationId)
    )
    .orderBy(asc(sceneShotVideoTakeGenerationShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

export function buildSceneShotVideoTakeGenerationCompatibilitySnapshot(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
  shotList: SceneShotListDocument;
  shotIds: string[];
}): SceneShotVideoTakeGenerationCompatibilitySnapshot {
  const selectedShots = shotsForIds(input.shotList.shots, input.shotIds);
  return {
    activeShotListId: readActiveSceneShotListId(input.session, input.sceneId),
    orderedShotIds: input.shotList.shots.map((shot) => shot.shotId),
    shotListContentFingerprint: shotListContentFingerprint(input.shotList.shots),
    storyboardStateFingerprint: storyboardStateFingerprint({
      session: input.session,
      shotListId: input.shotListId,
      shotIds: input.shotList.shots.map((shot) => shot.shotId),
    }),
    selectedShotIds: input.shotIds,
    selectedShotContentFingerprint: shotListContentFingerprint(selectedShots),
    selectedStoryboardStateFingerprint: storyboardStateFingerprint({
      session: input.session,
      shotListId: input.shotListId,
      shotIds: input.shotIds,
    }),
  };
}

function toSceneShotVideoTakeGeneration(
  session: DatabaseSession,
  input: { row: SceneShotVideoTakeGenerationRecord; screenplay: ScreenplayDocument }
): SceneShotVideoTakeGeneration {
  const production = parseShotVideoTakeGenerationProduction({
    value: input.row.production,
  });
  const snapshot = parseSceneShotVideoTakeGenerationCompatibilitySnapshot({
    value: input.row.compatibilitySnapshot,
  });
  const shotIds = listSceneShotVideoTakeGenerationShotIds(
    session,
    input.row.id
  );
  return {
    takeGenerationId: input.row.id,
    sceneId: input.row.sceneId,
    shotListId: input.row.shotListId,
    title: input.row.title,
    shotIds,
    production,
    compatibility: projectSceneShotVideoTakeGenerationCompatibility(session, {
      row: input.row,
      snapshot,
      shotIds,
      screenplay: input.screenplay,
    }),
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
  };
}

function projectSceneShotVideoTakeGenerationCompatibility(
  session: DatabaseSession,
  input: {
    row: SceneShotVideoTakeGenerationRecord;
    snapshot: SceneShotVideoTakeGenerationCompatibilitySnapshot;
    shotIds: string[];
    screenplay: ScreenplayDocument;
  }
): SceneShotVideoTakeGenerationCompatibility {
  const reasons: SceneShotVideoTakeGenerationIncompatibilityReason[] = [];
  const activeShotListId = readActiveSceneShotListId(session, input.row.sceneId);
  if (activeShotListId !== input.snapshot.activeShotListId) {
    reasons.push('active-shot-list-changed');
  }
  const currentShotListRow = requireSceneShotListRecord(
    session,
    input.row.shotListId
  );
  const currentShotList = readSceneShotListDocument({
    row: currentShotListRow,
    screenplay: input.screenplay,
  });
  if (
    shotListContentFingerprint(currentShotList.shots) !==
    input.snapshot.shotListContentFingerprint
  ) {
    reasons.push('shot-list-content-changed');
  }
  if (
    storyboardStateFingerprint({
      session,
      shotListId: input.row.shotListId,
      shotIds: currentShotList.shots.map((shot) => shot.shotId),
    }) !== input.snapshot.storyboardStateFingerprint
  ) {
    reasons.push('storyboard-images-changed');
  }
  const currentShotIds = new Set(
    currentShotList.shots.map((shot) => shot.shotId)
  );
  const selectedShotsMissing = input.shotIds.some(
    (shotId) => !currentShotIds.has(shotId)
  );
  if (selectedShotsMissing) {
    reasons.push('selected-shots-missing');
  } else {
    const selectedShots = shotsForIds(currentShotList.shots, input.shotIds);
    if (
      shotListContentFingerprint(selectedShots) !==
      input.snapshot.selectedShotContentFingerprint
    ) {
      reasons.push('selected-shot-content-changed');
    }
    if (
      storyboardStateFingerprint({
        session,
        shotListId: input.row.shotListId,
        shotIds: input.shotIds,
      }) !== input.snapshot.selectedStoryboardStateFingerprint
    ) {
      reasons.push('selected-storyboard-images-changed');
    }
  }
  return {
    editState: reasons.length > 0 ? 'view-only' : 'editable',
    reasons,
    message:
      reasons.length > 0
        ? 'This take generation no longer matches the current shot list.'
        : 'This take generation matches the current shot list.',
  };
}

function insertTakeGenerationShotMembership(input: {
  session: DatabaseSession;
  takeGenerationId: string;
  shotListId: string;
  shotList: SceneShotListDocument;
  shotIds: string[];
}): void {
  const shots = shotsForIds(input.shotList.shots, input.shotIds);
  shots.forEach((shot, shotOrder) => {
    const storyboardImage = readLatestSceneShotStoryboardImage({
      session: input.session,
      shotListId: input.shotListId,
      shotId: shot.shotId,
    });
    input.session.db
      .insert(sceneShotVideoTakeGenerationShots)
      .values({
        takeGenerationId: input.takeGenerationId,
        shotId: shot.shotId,
        shotOrder,
        shotContentFingerprint: shotContentFingerprint(shot),
        storyboardImageId: storyboardImage?.id ?? null,
        storyboardAssetFileId: storyboardImage?.assetFileId ?? null,
        storyboardContentFingerprint: storyboardImageFingerprint(storyboardImage),
      })
      .run();
  });
}

function shotsForIds(shots: SceneShot[], shotIds: string[]): SceneShot[] {
  const shotsById = new Map(shots.map((shot) => [shot.shotId, shot]));
  return shotIds.map((shotId) => {
    const shot = shotsById.get(shotId);
    if (!shot) {
      throw new ProjectDataError(
        'PROJECT_DATA325',
        `Shot id is not in the Scene Shot List: ${shotId}.`
      );
    }
    return shot;
  });
}

function normalizeShotIds(shots: SceneShot[], shotIds: string[]): string[] {
  if (shotIds.length === 0) {
    throw new ProjectDataError(
      'PROJECT_DATA379',
      'Shot video take generation requires at least one shot id.'
    );
  }
  const valid = new Set(shots.map((shot) => shot.shotId));
  const unique = new Set<string>();
  for (const shotId of shotIds) {
    if (!valid.has(shotId)) {
      throw new ProjectDataError(
        'PROJECT_DATA325',
        `Shot id is not in the Scene Shot List: ${shotId}.`
      );
    }
    if (unique.has(shotId)) {
      throw new ProjectDataError(
        'PROJECT_DATA380',
        `Shot id is duplicated in the take generation: ${shotId}.`
      );
    }
    unique.add(shotId);
  }
  const ordered = shots
    .filter((shot) => unique.has(shot.shotId))
    .map((shot) => shot.shotId);
  if (!isContiguous(ordered, shots)) {
    throw new ProjectDataError(
      'PROJECT_DATA381',
      'Shot video take generations must use contiguous shot ids.'
    );
  }
  return ordered;
}

function isContiguous(shotIds: string[], shots: SceneShot[]): boolean {
  if (shotIds.length < 2) {
    return true;
  }
  const indexes = shotIds.map((shotId) =>
    shots.findIndex((shot) => shot.shotId === shotId)
  );
  return indexes.every(
    (index, position) => position === 0 || index === indexes[position - 1] + 1
  );
}

function shotListContentFingerprint(shots: SceneShot[]): string {
  return JSON.stringify(
    shots.map((shot) => ({
      shotId: shot.shotId,
      content: shotContentFingerprint(shot),
    }))
  );
}

function storyboardStateFingerprint(input: {
  session: DatabaseSession;
  shotListId: string;
  shotIds: string[];
}): string {
  return JSON.stringify(
    input.shotIds.map((shotId) => {
      const image = readLatestSceneShotStoryboardImage({
        session: input.session,
        shotListId: input.shotListId,
        shotId,
      });
      return {
        shotId,
        image: storyboardImageFingerprint(image),
      };
    })
  );
}

function storyboardImageFingerprint(
  image: ReturnType<typeof readLatestSceneShotStoryboardImage>
): string {
  return JSON.stringify(
    image
      ? {
          id: image.id,
          assetFileId: image.assetFileId,
          shotContentFingerprint: image.shotContentFingerprint,
        }
      : null
  );
}

function defaultTakeGenerationTitle(shotIds: string[]): string {
  return shotIds.length === 1
    ? `Take generation for ${shotIds[0]}`
    : `Take generation for ${shotIds[0]}-${shotIds[shotIds.length - 1]}`;
}
