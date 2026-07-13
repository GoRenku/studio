import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type {
  SceneShotVideoTake,
  SceneShotVideoTakeListReport,
  SceneShotVideoTakeOverview,
  ShotVideoTakeStoryboardImageReference,
} from '../../client/shot-video-take-workspace.js';
import type { ProjectRelativePath } from '../../client/project.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import { readAssetRecord } from '../database/access/assets.js';
import {
  readActiveSceneShotListId,
  readSceneShotListDocument,
  requireSceneShotListForScene,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  sceneShotStoryboardImages,
  sceneShotVideoTakes,
  sceneShotVideoTakeShots,
  sceneShotVideoTakeVideos,
} from '../schema/index.js';
import { parseShotVideoTakeState, projectShotWithTakeDirection } from './state.js';

export type ShotVideoTakeRecord = typeof sceneShotVideoTakes.$inferSelect;

export function requireShotVideoTakeRecord(
  session: DatabaseSession,
  takeId: string
): ShotVideoTakeRecord {
  const record = session.db
    .select()
    .from(sceneShotVideoTakes)
    .where(and(eq(sceneShotVideoTakes.id, takeId), isNull(sceneShotVideoTakes.discardedAt)))
    .get();
  if (!record) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_NOT_FOUND',
      `Shot Video Take was not found: ${takeId}.`
    );
  }
  return record;
}

export function requireShotVideoTakeForScene(input: {
  session: DatabaseSession;
  sceneId: string;
  takeId: string;
}): ShotVideoTakeRecord {
  const take = requireShotVideoTakeRecord(input.session, input.takeId);
  if (take.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_OWNER_MISMATCH',
      'Shot Video Take does not belong to the requested Scene.'
    );
  }
  return take;
}

export function requireShotVideoTakeSelectionContext(input: {
  session: DatabaseSession;
  sceneId: string;
  takeId: string;
  selectedShotId?: string;
}): ShotVideoTakeRecord {
  const take = requireShotVideoTakeForScene(input);
  if (
    input.selectedShotId &&
    !readShotIds(input.session, input.takeId).includes(input.selectedShotId)
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_SELECTED_SHOT_INVALID',
      'The selected Shot does not belong to this Shot Video Take.'
    );
  }
  return take;
}

export function readShotVideoTakeDomain(input: {
  session: DatabaseSession;
  takeId: string;
}): SceneShotVideoTake {
  const record = requireShotVideoTakeRecord(input.session, input.takeId);
  const shotIds = readShotIds(input.session, record.id);
  const state = parseShotVideoTakeState({ value: record.stateJson, shotIds });
  const activeShotListId = readActiveSceneShotListId(input.session, record.sceneId);
  const historyChanged = activeShotListId !== record.sourceShotListId;
  return {
    takeId: record.id,
    sceneId: record.sceneId,
    sourceShotListId: record.sourceShotListId,
    title: record.title,
    shotIds,
    picked: record.isPicked,
    video: readTakeVideo(input.session, record.id),
    state,
    status: {
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
      archive: { state: 'active', message: 'This take is active.' },
      history: {
        differences: historyChanged ? ['active-shot-list-changed'] : [],
        message: historyChanged
          ? 'This take has history differences from the current Scene state.'
          : 'This take matches its recorded history snapshot.',
      },
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function readShotVideoTakeOverview(input: {
  session: DatabaseSession;
  takeId: string;
}): SceneShotVideoTakeOverview {
  const take = readShotVideoTakeDomain(input);
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_CONTEXT_UNAVAILABLE',
      'A screenplay is required to read a Shot Video Take.'
    );
  }
  const row = requireSceneShotListForScene({
    session: input.session,
    sceneId: take.sceneId,
    shotListId: take.sourceShotListId,
  });
  const shotList = readSceneShotListDocument({ row, screenplay });
  const displayShots = shotList.shots.map((shot) =>
    projectShotWithTakeDirection({ shot, state: take.state })
  );
  return {
    take,
    sourceShotList: {
      id: row.id,
      title: shotList.title,
      summary: shotList.summary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isActive: readActiveSceneShotListId(input.session, take.sceneId) === row.id,
    },
    displayShots,
    overviewShotIds: [...take.shotIds],
    storyboardImages: listStoryboardImages({
      session: input.session,
      sceneId: take.sceneId,
      shotListId: take.sourceShotListId,
    }),
  };
}

export function listShotVideoTakeOverviews(input: {
  session: DatabaseSession;
  sceneId: string;
}): SceneShotVideoTakeListReport {
  const takeIds = input.session.db
    .select({ id: sceneShotVideoTakes.id })
    .from(sceneShotVideoTakes)
    .where(and(eq(sceneShotVideoTakes.sceneId, input.sceneId), isNull(sceneShotVideoTakes.discardedAt)))
    .orderBy(
      desc(sceneShotVideoTakes.isPicked),
      desc(sceneShotVideoTakes.updatedAt),
      desc(sceneShotVideoTakes.id)
    )
    .all();
  return {
    takes: takeIds.map(({ id }) =>
      readShotVideoTakeOverview({ session: input.session, takeId: id })
    ),
  };
}

export function listStoryboardImages(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
}): ShotVideoTakeStoryboardImageReference[] {
  return input.session.db
    .select()
    .from(sceneShotStoryboardImages)
    .where(
      and(
        eq(sceneShotStoryboardImages.sceneId, input.sceneId),
        eq(sceneShotStoryboardImages.shotListId, input.shotListId)
      )
    )
    .orderBy(asc(sceneShotStoryboardImages.createdAt), asc(sceneShotStoryboardImages.id))
    .all()
    .flatMap((image) => {
      const asset = readAssetRecord(input.session, image.assetId);
      const file = readAssetFileRecord(input.session, {
        assetId: image.assetId,
        assetFileId: image.assetFileId,
      });
      if (!asset || !file) {
        return [];
      }
      return [{
        shotId: image.shotId,
        assetId: asset.id,
        relationshipId: image.id,
        assetFileId: file.id,
        title: asset.title,
        fileRole: file.role,
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
        projectRelativePath: file.projectRelativePath as ProjectRelativePath,
      }];
    });
}

function readShotIds(session: DatabaseSession, takeId: string): string[] {
  return session.db
    .select({ shotId: sceneShotVideoTakeShots.shotId })
    .from(sceneShotVideoTakeShots)
    .where(and(eq(sceneShotVideoTakeShots.takeId, takeId), isNull(sceneShotVideoTakeShots.discardedAt)))
    .orderBy(asc(sceneShotVideoTakeShots.shotOrder))
    .all()
    .map(({ shotId }) => shotId);
}

function readTakeVideo(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTake['video'] {
  const row = session.db
    .select()
    .from(sceneShotVideoTakeVideos)
    .where(and(eq(sceneShotVideoTakeVideos.takeId, takeId), isNull(sceneShotVideoTakeVideos.discardedAt)))
    .get();
  if (!row) {
    return null;
  }
  const file = readAssetFileRecord(session, {
    assetId: row.assetId,
    assetFileId: row.assetFileId,
  });
  if (!file) {
    return null;
  }
  const provenance = readAssetFileGenerationRecord(session, file.id);
  return {
    takeId,
    assetId: row.assetId,
    assetFileId: row.assetFileId,
    ...(provenance ? { generationRunId: provenance.mediaGenerationRunId } : {}),
    projectRelativePath: file.projectRelativePath as ProjectRelativePath,
    mimeType: file.mimeType,
    createdAt: row.createdAt,
  };
}
