import { eq } from 'drizzle-orm';
import type {
  SceneShotVideoTakeCreateReport,
  ShotVideoTakePickReport,
  ShotVideoTakeWorkspaceMutationReport,
} from '../../client/shot-video-take-workspace.js';
import {
  readLatestSceneShotStoryboardImage,
  readSceneShotListDocument,
  requireSceneShotListForScene,
  shotContentFingerprint,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { readProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneShotVideoTakes, sceneShotVideoTakeShots } from '../schema/index.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { requireContiguousShotIds } from './contracts.js';
import {
  readShotVideoTakeDomain,
  readShotVideoTakeOverview,
  requireShotVideoTakeForScene,
} from './queries.js';
import {
  emptyShotVideoTakeState,
  parseShotVideoTakeState,
  replaceShotVideoTakeMembershipState,
  serializeShotVideoTakeState,
} from './state.js';
import { readShotVideoTakeWorkspace } from './workspace.js';

export function createShotVideoTake(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
  shotIds: string[];
  title?: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): SceneShotVideoTakeCreateReport {
  const screenplay = requireScreenplay(input.session);
  const row = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
  });
  const shotList = readSceneShotListDocument({ row, screenplay });
  const shotIds = requireContiguousShotIds({ shots: shotList.shots, shotIds: input.shotIds });
  const takeId = input.idGenerator.next('scene_shot_video_take');
  const title = input.title?.trim() || defaultTakeTitle(shotIds);
  input.session.db.transaction((tx) => {
    tx.insert(sceneShotVideoTakes).values({
      id: takeId,
      sceneId: input.sceneId,
      sourceShotListId: input.shotListId,
      title,
      stateJson: serializeShotVideoTakeState(emptyShotVideoTakeState()),
      isPicked: false,
      regeneratedFromTakeId: null,
      mediaFolderProjectRelativePath: null,
      historySnapshot: JSON.stringify({
        activeShotListId: input.shotListId,
        selectedShotIds: shotIds,
      }),
      createdAt: input.now,
      updatedAt: input.now,
    }).run();
    for (const [shotOrder, shotId] of shotIds.entries()) {
      const shot = shotList.shots.find((candidate) => candidate.shotId === shotId)!;
      const storyboard = readLatestSceneShotStoryboardImage({
        session: { ...input.session, db: tx },
        shotListId: input.shotListId,
        shotId,
      });
      tx.insert(sceneShotVideoTakeShots).values({
        takeId,
        shotId,
        shotOrder,
        shotContentFingerprint: shotContentFingerprint(shot),
        storyboardImageId: storyboard?.id ?? null,
        storyboardAssetFileId: storyboard?.assetFileId ?? null,
        storyboardContentFingerprint: JSON.stringify(storyboard?.assetFileId ?? null),
      }).run();
    }
  });
  return {
    overview: readShotVideoTakeOverview({ session: input.session, takeId }),
    resourceKeys: resourceKeys(input.sceneId, takeId),
  };
}

export function discardShotVideoTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
}): { resourceKeys: string[]; recovery: ShotVideoTakeWorkspaceMutationReport['recovery'] } {
  requireShotVideoTakeForScene(input);
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_CONTEXT_UNAVAILABLE',
      'Project metadata is required to discard a Shot Video Take.'
    );
  }
  const report = discardTrashObject({
    session: input.session,
    project,
    projectFolder: input.projectFolder,
    itemKind: 'sceneShotVideoTake',
    itemId: input.takeId,
    commandName: 'shot-video-take.discard',
    changes: [{ type: 'sceneShotVideoTake.discarded', takeId: input.takeId }],
  });
  return {
    resourceKeys: resourceKeys(input.sceneId, input.takeId),
    recovery: report.recovery,
  };
}

export function setShotVideoTakePicked(input: {
  session: DatabaseSession;
  sceneId: string;
  takeId: string;
  picked: boolean;
  now: string;
}): ShotVideoTakePickReport {
  requireShotVideoTakeForScene(input);
  input.session.db
    .update(sceneShotVideoTakes)
    .set({ isPicked: input.picked, updatedAt: input.now })
    .where(eq(sceneShotVideoTakes.id, input.takeId))
    .run();
  return {
    take: readShotVideoTakeDomain({ session: input.session, takeId: input.takeId }),
    resourceKeys: resourceKeys(input.sceneId, input.takeId),
  };
}

export async function replaceShotVideoTakeShots(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  shotIds: string[];
  now: string;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  const record = requireShotVideoTakeForScene(input);
  const screenplay = requireScreenplay(input.session);
  const row = requireSceneShotListForScene({
    session: input.session,
    sceneId: input.sceneId,
    shotListId: record.sourceShotListId,
  });
  const shotList = readSceneShotListDocument({ row, screenplay });
  const shotIds = requireContiguousShotIds({ shots: shotList.shots, shotIds: input.shotIds });
  const previousShotIds = input.session.db
    .select({ shotId: sceneShotVideoTakeShots.shotId })
    .from(sceneShotVideoTakeShots)
    .where(eq(sceneShotVideoTakeShots.takeId, input.takeId))
    .all()
    .map(({ shotId }) => shotId);
  const state = replaceShotVideoTakeMembershipState({
    state: parseShotVideoTakeState({ value: record.stateJson, shotIds: previousShotIds }),
    shotIds,
  });
  input.session.db.transaction((tx) => {
    tx.delete(sceneShotVideoTakeShots)
      .where(eq(sceneShotVideoTakeShots.takeId, input.takeId))
      .run();
    for (const [shotOrder, shotId] of shotIds.entries()) {
      const shot = shotList.shots.find((candidate) => candidate.shotId === shotId)!;
      const storyboard = readLatestSceneShotStoryboardImage({
        session: { ...input.session, db: tx },
        shotListId: record.sourceShotListId,
        shotId,
      });
      tx.insert(sceneShotVideoTakeShots).values({
        takeId: input.takeId,
        shotId,
        shotOrder,
        shotContentFingerprint: shotContentFingerprint(shot),
        storyboardImageId: storyboard?.id ?? null,
        storyboardAssetFileId: storyboard?.assetFileId ?? null,
        storyboardContentFingerprint: JSON.stringify(storyboard?.assetFileId ?? null),
      }).run();
    }
    tx.update(sceneShotVideoTakes)
      .set({
        stateJson: serializeShotVideoTakeState(state),
        historySnapshot: JSON.stringify({
          activeShotListId: record.sourceShotListId,
          selectedShotIds: shotIds,
        }),
        updatedAt: input.now,
      })
      .where(eq(sceneShotVideoTakes.id, input.takeId))
      .run();
  });
  const workspace = await readShotVideoTakeWorkspace(input);
  return { workspace, resourceKeys: workspace.resourceKeys };
}

export function resourceKeys(sceneId: string, takeId: string): string[] {
  return [`scene:${sceneId}`, `scene-shot-video-take:${takeId}`];
}

function requireScreenplay(session: DatabaseSession) {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_CONTEXT_UNAVAILABLE',
      'A screenplay is required for Shot Video Take commands.'
    );
  }
  return screenplay;
}

function defaultTakeTitle(shotIds: string[]): string {
  return shotIds.length === 1
    ? `Take for ${shotIds[0]}`
    : `Take for ${shotIds[0]}-${shotIds[shotIds.length - 1]}`;
}
