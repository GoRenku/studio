import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type {
  SceneShot,
  SceneShotListDocument,
  SceneShotVideoTakeProductionState,
} from '../../../client/scene-shot-list.js';
import type {
  SceneShotVideoTake,
  SceneShotVideoTakeDirection,
  SceneShotVideoTakeReferenceSelections,
  SceneShotVideoTakeStatus,
  SceneShotVideoTakeHistorySnapshot,
  SceneShotVideoTakeHistoryDifference,
  SceneShotVideoTakeState,
} from '../../../client/shot-video-take.js';
import {
  parseSceneShotVideoTakeHistorySnapshot,
  parseSceneShotVideoTakeState,
  serializeSceneShotVideoTakeHistorySnapshot,
  serializeSceneShotVideoTakeState,
} from '../../shot-video-take-json/validator.js';
import {
  sceneShotVideoTakeShots,
  sceneShotVideoTakes,
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
  buildSceneShotVideoTakeState,
  carrySceneShotVideoTakeStateForShotMembership,
  setSceneShotVideoTakeStructureMode,
  updateSceneShotVideoTakeDirectionReferenceSelections,
  updateSceneShotVideoTakeStateProduction,
  updateSceneShotVideoTakeDirection,
  validateSceneShotVideoTakeStructure,
} from '../../media-generation/shot-video-take/take-state.js';

export type SceneShotVideoTakeRecord =
  typeof sceneShotVideoTakes.$inferSelect;

export interface CreateSceneShotVideoTakeRecordInput {
  id: string;
  sceneId: string;
  shotListId: string;
  title?: string;
  shotIds: string[];
  production?: SceneShotVideoTakeProductionState;
  screenplay: ScreenplayDocument;
  now: string;
}

export function insertSceneShotVideoTakeRecord(
  session: DatabaseSession,
  input: CreateSceneShotVideoTakeRecordInput
): SceneShotVideoTake {
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
  const snapshot = buildSceneShotVideoTakeHistorySnapshot({
    session,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    shotList,
    shotIds,
  });
  session.db
    .insert(sceneShotVideoTakes)
    .values({
      id: input.id,
      sceneId: input.sceneId,
      sourceShotListId: input.shotListId,
      title: input.title ?? defaultTakeTitle(shotIds),
      stateJson: serializeSceneShotVideoTakeState({
        state: buildSceneShotVideoTakeState({
          shots: shotList.shots,
          shotIds,
          production: input.production ?? {},
        }),
      }),
      historySnapshot:
        serializeSceneShotVideoTakeHistorySnapshot({
          snapshot,
        }),
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  insertTakeShotMembership({
    session,
    takeId: input.id,
    shotListId: input.shotListId,
    shotList,
    shotIds,
  });
  return requireSceneShotVideoTake(session, {
    takeId: input.id,
    screenplay: input.screenplay,
  });
}

export function requireSceneShotVideoTake(
  session: DatabaseSession,
  input: { takeId: string; screenplay: ScreenplayDocument }
): SceneShotVideoTake {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakes)
      .where(and(eq(sceneShotVideoTakes.id, input.takeId), isNull(sceneShotVideoTakes.discardedAt)))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA419',
      `Scene Shot Video Take was not found: ${input.takeId}.`
    );
  }
  return toSceneShotVideoTake(session, {
    row,
    screenplay: input.screenplay,
  });
}

export function listSceneShotVideoTakesForScene(
  session: DatabaseSession,
  input: { sceneId: string; screenplay: ScreenplayDocument }
): SceneShotVideoTake[] {
  return session.db
    .select()
    .from(sceneShotVideoTakes)
    .where(and(eq(sceneShotVideoTakes.sceneId, input.sceneId), isNull(sceneShotVideoTakes.discardedAt)))
    .orderBy(
      desc(sceneShotVideoTakes.isPicked),
      desc(sceneShotVideoTakes.updatedAt),
      desc(sceneShotVideoTakes.id)
    )
    .all()
    .map((row) =>
      toSceneShotVideoTake(session, {
        row,
        screenplay: input.screenplay,
      })
    );
}

export function updateSceneShotVideoTakeProductionRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    production: SceneShotVideoTakeProductionState;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  const currentState = currentSceneShotVideoTakeState(session, {
    takeId: input.takeId,
  });
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({
        state: updateSceneShotVideoTakeStateProduction({
          state: currentState,
          production: input.production,
        }),
      }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeShotMembershipRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    shotIds: string[];
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  const take = requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
  const shotListRow = requireSceneShotListForScene({
    session,
    sceneId: take.sceneId,
    shotListId: take.sourceShotListId,
  });
  const shotList = readSceneShotListDocument({
    row: shotListRow,
    screenplay: input.screenplay,
  });
  const shotIds = normalizeShotIds(shotList.shots, input.shotIds);
  const snapshot = buildSceneShotVideoTakeHistorySnapshot({
    session,
    sceneId: take.sceneId,
    shotListId: take.sourceShotListId,
    shotList,
    shotIds,
  });
  session.db
    .delete(sceneShotVideoTakeShots)
    .where(
      eq(
        sceneShotVideoTakeShots.takeId,
        input.takeId
      )
    )
    .run();
  insertTakeShotMembership({
    session,
    takeId: input.takeId,
    shotListId: take.sourceShotListId,
    shotList,
    shotIds,
  });
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({
        state: carrySceneShotVideoTakeStateForShotMembership({
          state: take.state,
          shots: shotList.shots,
          previousShotIds: take.shotIds,
          shotIds,
        }),
      }),
      historySnapshot:
        serializeSceneShotVideoTakeHistorySnapshot({
          snapshot,
        }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeDirectionRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    shotId?: string;
    direction: SceneShotVideoTakeDirection | null;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  const take = requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
  if (input.shotId && !take.shotIds.includes(input.shotId)) {
    throw new ProjectDataError(
      'PROJECT_DATA422',
      `Shot id is not in the Scene Shot Video Take: ${input.shotId}.`
    );
  }
  const state = updateSceneShotVideoTakeDirection({
    state: take.state,
    shotId: input.shotId,
    direction: input.direction,
  });
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({ state }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeReferenceSelectionsRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    shotId?: string;
    referenceSelections: SceneShotVideoTakeReferenceSelections;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  const take = requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
  if (input.shotId && !take.shotIds.includes(input.shotId)) {
    throw new ProjectDataError(
      'PROJECT_DATA422',
      `Shot id is not in the Scene Shot Video Take: ${input.shotId}.`
    );
  }
  const state = updateSceneShotVideoTakeDirectionReferenceSelections({
    state: take.state,
    shotId: input.shotId,
    referenceSelections: input.referenceSelections,
  });
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({ state }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeStructureModeRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    mode: SceneShotVideoTakeState['structure']['mode'];
    sourceShotId?: string;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  const take = requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
  const state = setSceneShotVideoTakeStructureMode({
    state: take.state,
    shotIds: take.shotIds,
    mode: input.mode,
    sourceShotId: input.sourceShotId,
  });
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({ state }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakeStateRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    state: SceneShotVideoTakeState;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  session.db
    .update(sceneShotVideoTakes)
    .set({
      stateJson: serializeSceneShotVideoTakeState({ state: input.state }),
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function updateSceneShotVideoTakePickRecord(
  session: DatabaseSession,
  input: {
    takeId: string;
    picked: boolean;
    screenplay: ScreenplayDocument;
    now: string;
  }
): SceneShotVideoTake {
  session.db
    .update(sceneShotVideoTakes)
    .set({
      isPicked: input.picked,
      updatedAt: input.now,
    })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return requireSceneShotVideoTake(session, {
    takeId: input.takeId,
    screenplay: input.screenplay,
  });
}

export function listSceneShotVideoTakeShotIds(
  session: DatabaseSession,
  takeId: string
): string[] {
  return session.db
    .select()
    .from(sceneShotVideoTakeShots)
    .where(
      eq(sceneShotVideoTakeShots.takeId, takeId)
    )
    .orderBy(asc(sceneShotVideoTakeShots.shotOrder))
    .all()
    .map((row) => row.shotId);
}

export function buildSceneShotVideoTakeHistorySnapshot(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
  shotList: SceneShotListDocument;
  shotIds: string[];
}): SceneShotVideoTakeHistorySnapshot {
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

function toSceneShotVideoTake(
  session: DatabaseSession,
  input: { row: SceneShotVideoTakeRecord; screenplay: ScreenplayDocument }
): SceneShotVideoTake {
  const state = parseSceneShotVideoTakeState({
    value: input.row.stateJson,
  });
  const snapshot = parseSceneShotVideoTakeHistorySnapshot({
    value: input.row.historySnapshot,
  });
  const shotIds = listSceneShotVideoTakeShotIds(
    session,
    input.row.id
  );
  validateSceneShotVideoTakeStructure({ state, shotIds });
  return {
    takeId: input.row.id,
    sceneId: input.row.sceneId,
    sourceShotListId: input.row.sourceShotListId,
    title: input.row.title,
    shotIds,
    picked: input.row.isPicked,
    state,
    status: projectSceneShotVideoTakeStatus(session, {
      row: input.row,
      snapshot,
      shotIds,
      screenplay: input.screenplay,
    }),
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
  };
}

function projectSceneShotVideoTakeStatus(
  session: DatabaseSession,
  input: {
    row: SceneShotVideoTakeRecord;
    snapshot: SceneShotVideoTakeHistorySnapshot;
    shotIds: string[];
    screenplay: ScreenplayDocument;
  }
): SceneShotVideoTakeStatus {
  const differences: SceneShotVideoTakeHistoryDifference[] = [];
  const activeShotListId = readActiveSceneShotListId(session, input.row.sceneId);
  if (activeShotListId !== input.snapshot.activeShotListId) {
    differences.push('active-shot-list-changed');
  }
  const currentShotListRow = requireSceneShotListRecord(
    session,
    input.row.sourceShotListId
  );
  const currentShotList = readSceneShotListDocument({
    row: currentShotListRow,
    screenplay: input.screenplay,
  });
  if (
    shotListContentFingerprint(currentShotList.shots) !==
    input.snapshot.shotListContentFingerprint
  ) {
    differences.push('shot-list-content-changed');
  }
  if (
    storyboardStateFingerprint({
      session,
      shotListId: input.row.sourceShotListId,
      shotIds: currentShotList.shots.map((shot) => shot.shotId),
    }) !== input.snapshot.storyboardStateFingerprint
  ) {
    differences.push('storyboard-images-changed');
  }
  const currentShotIds = new Set(
    currentShotList.shots.map((shot) => shot.shotId)
  );
  const selectedShotsMissing = input.shotIds.some(
    (shotId) => !currentShotIds.has(shotId)
  );
  if (selectedShotsMissing) {
    differences.push('selected-shots-missing');
  } else {
    const selectedShots = shotsForIds(currentShotList.shots, input.shotIds);
    if (
      shotListContentFingerprint(selectedShots) !==
      input.snapshot.selectedShotContentFingerprint
    ) {
      differences.push('selected-shot-content-changed');
    }
    if (
      storyboardStateFingerprint({
        session,
        shotListId: input.row.sourceShotListId,
        shotIds: input.shotIds,
      }) !== input.snapshot.selectedStoryboardStateFingerprint
    ) {
      differences.push('selected-storyboard-images-changed');
    }
  }
  return {
    editability: {
      state: 'editable',
      diagnostics: [],
      message: 'This take is editable.',
    },
    resolvability: {
      state: 'resolvable',
      diagnostics: [],
      message: 'All tracked take references resolve.',
    },
    runnability: {
      state: 'not-evaluated',
      diagnostics: [],
      message: 'Run readiness is evaluated by shot-video preflight.',
    },
    archive: {
      state: 'active',
      message: 'This take is active.',
    },
    history: {
      differences,
      message:
        differences.length > 0
          ? 'This take has history differences from the current scene state.'
          : 'This take matches its recorded history snapshot.',
    },
  };
}

function currentSceneShotVideoTakeState(
  session: DatabaseSession,
  input: { takeId: string }
): SceneShotVideoTakeState {
  const row =
    session.db
      .select()
      .from(sceneShotVideoTakes)
      .where(eq(sceneShotVideoTakes.id, input.takeId))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA419',
      `Scene Shot Video Take was not found: ${input.takeId}.`
    );
  }
  return parseSceneShotVideoTakeState({ value: row.stateJson });
}

function insertTakeShotMembership(input: {
  session: DatabaseSession;
  takeId: string;
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
      .insert(sceneShotVideoTakeShots)
      .values({
        takeId: input.takeId,
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
      'Shot Video Take requires at least one shot id.'
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
        `Shot id is duplicated in the Shot Video Take: ${shotId}.`
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
      'Shot Video Takes must use contiguous shot ids.'
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

function defaultTakeTitle(shotIds: string[]): string {
  return shotIds.length === 1
    ? `Take for ${shotIds[0]}`
    : `Take for ${shotIds[0]}-${shotIds[shotIds.length - 1]}`;
}
