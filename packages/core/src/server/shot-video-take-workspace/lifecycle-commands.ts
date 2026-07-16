import { and, asc, eq, isNull } from 'drizzle-orm';
import type { GenerationSpec } from '../../client/generation.js';
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
import { requireSceneShotVideoTakeAuthoringOpen } from '../database/access/shot-video-take-media.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  assets,
  mediaGenerationRuns,
  mediaGenerationSpecs,
  sceneShotVideoTakeImages,
  sceneShotVideoTakes,
  sceneShotVideoTakeShots,
} from '../schema/index.js';
import {
  commitProjectAssetFileWriteSet,
  copyTakeOwnedProjectAssetFileSync,
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../project-asset-files/index.js';
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

export function createSceneShotVideoTakeFromTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  sourceTakeId: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): SceneShotVideoTakeCreateReport {
  const source = requireShotVideoTakeForScene({ ...input, takeId: input.sourceTakeId });
  const success = input.session.db.select({ id: mediaGenerationRuns.id })
    .from(mediaGenerationRuns)
    .where(and(
      eq(mediaGenerationRuns.purpose, 'shot.video-take'),
      eq(mediaGenerationRuns.targetKind, 'sceneShotVideoTake'),
      eq(mediaGenerationRuns.targetId, input.sourceTakeId),
      eq(mediaGenerationRuns.status, 'completed')
    )).get();
  if (!success) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_COMPLETED_SOURCE_REQUIRED',
      'New Take requires a completed source Take.'
    );
  }
  const targetTakeId = input.idGenerator.next('scene_shot_video_take');
  const sourceShots = input.session.db.select().from(sceneShotVideoTakeShots)
    .where(and(eq(sceneShotVideoTakeShots.takeId, input.sourceTakeId), isNull(sceneShotVideoTakeShots.discardedAt)))
    .orderBy(asc(sceneShotVideoTakeShots.shotOrder)).all();
  const sourceImages = input.session.db.select({
    image: sceneShotVideoTakeImages,
    asset: assets,
  }).from(sceneShotVideoTakeImages)
    .innerJoin(assets, eq(assets.id, sceneShotVideoTakeImages.assetId))
    .where(and(eq(sceneShotVideoTakeImages.takeId, input.sourceTakeId), isNull(sceneShotVideoTakeImages.discardedAt)))
    .all();
  const sourceSpecs = input.session.db.select().from(mediaGenerationSpecs)
    .where(and(
      eq(mediaGenerationSpecs.targetKind, 'sceneShotVideoTake'),
      eq(mediaGenerationSpecs.targetId, input.sourceTakeId)
    )).all();
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  const clonedFiles = new Map<string, { assetId: string; assetFileId: string }>();
  try {
    input.session.db.transaction((tx) => {
      const transactionSession = { ...input.session, db: tx };
      tx.insert(sceneShotVideoTakes).values({
        id: targetTakeId,
        sceneId: source.sceneId,
        sourceShotListId: source.sourceShotListId,
        title: `${source.title} — New Take`,
        stateJson: source.stateJson,
        isPicked: false,
        mediaFolderProjectRelativePath: null,
        historySnapshot: '{}',
        createdAt: input.now,
        updatedAt: input.now,
      }).run();
      for (const shot of sourceShots) {
        tx.insert(sceneShotVideoTakeShots).values({
          ...shot,
          takeId: targetTakeId,
          discardedAt: null,
          discardOperationId: null,
          restoredAt: null,
        }).run();
      }
      for (const { image, asset } of sourceImages) {
        const assetId = input.idGenerator.next('asset');
        const assetFileId = input.idGenerator.next('asset_file');
        tx.insert(assets).values({
          ...asset,
          id: assetId,
          origin: 'copied',
          createdAt: input.now,
          updatedAt: input.now,
          discardedAt: null,
          discardOperationId: null,
          restoredAt: null,
        }).run();
        copyTakeOwnedProjectAssetFileSync({
          session: transactionSession,
          projectFolder: input.projectFolder,
          writeSet,
          sourceAssetId: image.assetId,
          sourceAssetFileId: image.assetFileId,
          targetAssetId: assetId,
          targetAssetFileId: assetFileId,
          targetTakeId,
          role: image.role,
          fileRole: image.role,
          mediaKind: 'image',
          now: input.now,
        });
        tx.insert(sceneShotVideoTakeImages).values({
          takeId: targetTakeId,
          role: image.role,
          assetId,
          assetFileId,
          createdAt: input.now,
          updatedAt: input.now,
        }).run();
        clonedFiles.set(`${image.assetId}:${image.assetFileId}`, { assetId, assetFileId });
      }
      for (const record of sourceSpecs) {
        const spec = JSON.parse(record.referencesJson) as GenerationSpec['references'];
        const references = spec.map((selection) => {
          if (selection.reference.kind !== 'asset-file') {
            return selection;
          }
          const clone = clonedFiles.get(`${selection.reference.assetId}:${selection.reference.assetFileId}`);
          return clone ? { ...selection, reference: { kind: 'asset-file' as const, ...clone } } : selection;
        });
        tx.insert(mediaGenerationSpecs).values({
          ...record,
          id: input.idGenerator.next('media_generation_spec'),
          targetId: targetTakeId,
          referencesJson: JSON.stringify(references),
          createdAt: input.now,
          updatedAt: input.now,
        }).run();
      }
    });
    commitProjectAssetFileWriteSet(writeSet);
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  }
  return {
    overview: readShotVideoTakeOverview({ session: input.session, takeId: targetTakeId }),
    resourceKeys: resourceKeys(input.sceneId, targetTakeId),
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
  requireSceneShotVideoTakeAuthoringOpen(input);
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
