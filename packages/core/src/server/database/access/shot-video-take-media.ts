import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  sceneShotVideoTakeImages,
  sceneShotVideoTakeVideos,
  mediaGenerationRuns,
  sceneShotReferenceAssets,
  sceneShotVideoTakes,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readAssetOwnerTargets } from './asset-relationships/index.js';

export type ShotVideoTakeImageRole = 'first-frame' | 'last-frame' | 'video-prompt';

export interface SceneShotVideoTakeOwnedMedia {
  assetId: string;
  assetFileId: string;
}

export interface SceneShotVideoTakeOwnedMediaConflict extends SceneShotVideoTakeOwnedMedia {
  owner: string;
}

export function requireSceneShotVideoTakeAuthoringOpen(input: {
  session: DatabaseSession;
  takeId: string;
}): void {
  const successfulRun = input.session.db
    .select({ id: mediaGenerationRuns.id })
    .from(mediaGenerationRuns)
    .where(and(
      eq(mediaGenerationRuns.purpose, 'shot.video-take'),
      eq(mediaGenerationRuns.targetKind, 'sceneShotVideoTake'),
      eq(mediaGenerationRuns.targetId, input.takeId),
      inArray(mediaGenerationRuns.status, ['awaiting-attachment', 'completed'])
    ))
    .get();
  if (successfulRun) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_IMMUTABLE',
      'This Shot Video Take has completed its materializing generation. Create a New Take before changing its shots, direction, generation setup, or references.'
    );
  }
}

export function setSceneShotVideoTakeImage(input: {
  session: DatabaseSession;
  takeId: string;
  role: ShotVideoTakeImageRole;
  assetId: string;
  assetFileId: string;
  now: string;
}): void {
  const existing = input.session.db
    .select({ takeId: sceneShotVideoTakeImages.takeId })
    .from(sceneShotVideoTakeImages)
    .where(and(
      eq(sceneShotVideoTakeImages.takeId, input.takeId),
      eq(sceneShotVideoTakeImages.role, input.role),
      isNull(sceneShotVideoTakeImages.discardedAt)
    ))
    .get();
  requireSceneShotVideoTakeAuthoringOpen(input);
  if (existing) {
    input.session.db
      .update(sceneShotVideoTakeImages)
      .set({
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        updatedAt: input.now,
      })
      .where(and(
        eq(sceneShotVideoTakeImages.takeId, input.takeId),
        eq(sceneShotVideoTakeImages.role, input.role),
        isNull(sceneShotVideoTakeImages.discardedAt)
      ))
      .run();
    return;
  }
  input.session.db.insert(sceneShotVideoTakeImages).values({
    takeId: input.takeId,
    role: input.role,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function attachSuccessfulSceneShotVideoTakeVideo(input: {
  session: DatabaseSession;
  takeId: string;
  generationRunId: string;
  assetId: string;
  assetFileId: string;
  now: string;
}): void {
  const successfulRun = input.session.db
    .select({ id: mediaGenerationRuns.id })
    .from(mediaGenerationRuns)
    .where(and(
      eq(mediaGenerationRuns.id, input.generationRunId),
      eq(mediaGenerationRuns.purpose, 'shot.video-take'),
      eq(mediaGenerationRuns.targetKind, 'sceneShotVideoTake'),
      eq(mediaGenerationRuns.targetId, input.takeId),
      eq(mediaGenerationRuns.status, 'awaiting-attachment')
    ))
    .get();
  if (!successfulRun) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_SUCCESSFUL_RUN_REQUIRED',
      'A final Shot Video Take video requires its exact successful materializing generation run.'
    );
  }
  const existing = input.session.db
    .select({ takeId: sceneShotVideoTakeVideos.takeId })
    .from(sceneShotVideoTakeVideos)
    .where(and(
      eq(sceneShotVideoTakeVideos.takeId, input.takeId),
      isNull(sceneShotVideoTakeVideos.discardedAt)
    ))
    .get();
  if (existing) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_VIDEO_ALREADY_ATTACHED',
      'Shot Video Take already owns a current final video.'
    );
  }
  input.session.db.insert(sceneShotVideoTakeVideos).values({
    takeId: input.takeId,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
  input.session.db.update(mediaGenerationRuns)
    .set({ status: 'completed', completedAt: input.now })
    .where(eq(mediaGenerationRuns.id, input.generationRunId))
    .run();
}

export function listActiveSceneShotVideoTakeOwnedMedia(
  session: DatabaseSession,
  takeId: string
): SceneShotVideoTakeOwnedMedia[] {
  const media = [
    ...session.db
      .select({
        assetId: sceneShotVideoTakeImages.assetId,
        assetFileId: sceneShotVideoTakeImages.assetFileId,
      })
      .from(sceneShotVideoTakeImages)
      .where(and(
        eq(sceneShotVideoTakeImages.takeId, takeId),
        isNull(sceneShotVideoTakeImages.discardedAt)
      ))
      .all(),
    ...session.db
      .select({
        assetId: sceneShotVideoTakeVideos.assetId,
        assetFileId: sceneShotVideoTakeVideos.assetFileId,
      })
      .from(sceneShotVideoTakeVideos)
      .where(and(
        eq(sceneShotVideoTakeVideos.takeId, takeId),
        isNull(sceneShotVideoTakeVideos.discardedAt)
      ))
      .all(),
  ];
  return [...new Map(
    media.map((item) => [`${item.assetId}:${item.assetFileId}`, item])
  ).values()];
}

export function listSceneShotVideoTakeOwnedMediaConflicts(input: {
  session: DatabaseSession;
  takeId: string;
  media: SceneShotVideoTakeOwnedMedia[];
}): SceneShotVideoTakeOwnedMediaConflict[] {
  return input.media.flatMap((ownedMedia) => {
    const conflicts: SceneShotVideoTakeOwnedMediaConflict[] = [];
    const sharedVideos = input.session.db
      .select({ takeId: sceneShotVideoTakeVideos.takeId })
      .from(sceneShotVideoTakeVideos)
      .innerJoin(
        sceneShotVideoTakes,
        eq(sceneShotVideoTakeVideos.takeId, sceneShotVideoTakes.id)
      )
      .where(and(
        or(
          eq(sceneShotVideoTakeVideos.assetId, ownedMedia.assetId),
          eq(sceneShotVideoTakeVideos.assetFileId, ownedMedia.assetFileId)
        ),
        isNull(sceneShotVideoTakeVideos.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt),
        ne(sceneShotVideoTakeVideos.takeId, input.takeId)
      ))
      .all();
    for (const sharedVideo of sharedVideos) {
      conflicts.push({
        ...ownedMedia,
        owner: `scene_shot_video_take_video ${sharedVideo.takeId}`,
      });
    }
    const sharedImages = input.session.db
      .select({ takeId: sceneShotVideoTakeImages.takeId })
      .from(sceneShotVideoTakeImages)
      .innerJoin(
        sceneShotVideoTakes,
        eq(sceneShotVideoTakeImages.takeId, sceneShotVideoTakes.id)
      )
      .where(and(
        or(
          eq(sceneShotVideoTakeImages.assetId, ownedMedia.assetId),
          eq(sceneShotVideoTakeImages.assetFileId, ownedMedia.assetFileId)
        ),
        isNull(sceneShotVideoTakeImages.discardedAt),
        isNull(sceneShotVideoTakes.discardedAt),
        ne(sceneShotVideoTakeImages.takeId, input.takeId)
      ))
      .all();
    for (const sharedImage of sharedImages) {
      conflicts.push({
        ...ownedMedia,
        owner: `scene_shot_video_take_image ${sharedImage.takeId}`,
      });
    }
    const shotReferences = input.session.db
      .select({ shotId: sceneShotReferenceAssets.shotId })
      .from(sceneShotReferenceAssets)
      .where(and(
        eq(sceneShotReferenceAssets.assetId, ownedMedia.assetId),
        isNull(sceneShotReferenceAssets.discardedAt)
      ))
      .all();
    for (const shotReference of shotReferences) {
      conflicts.push({
        ...ownedMedia,
        owner: `scene_shot_reference_asset ${shotReference.shotId}`,
      });
    }
    for (const owner of readAssetOwnerTargets(input.session, ownedMedia.assetId)) {
      conflicts.push({
        ...ownedMedia,
        owner: `active ${owner.kind} asset relationship`,
      });
    }
    return conflicts;
  });
}

export function countActiveSceneShotVideoTakeMediaOwners(
  session: DatabaseSession,
  assetId: string
): number {
  const videoOwners = session.db
    .select({ takeId: sceneShotVideoTakeVideos.takeId })
    .from(sceneShotVideoTakeVideos)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeVideos.takeId, sceneShotVideoTakes.id)
    )
    .where(and(
      eq(sceneShotVideoTakeVideos.assetId, assetId),
      isNull(sceneShotVideoTakeVideos.discardedAt),
      isNull(sceneShotVideoTakes.discardedAt)
    ))
    .all().length;
  const imageOwners = session.db
    .select({ takeId: sceneShotVideoTakeImages.takeId })
    .from(sceneShotVideoTakeImages)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeImages.takeId, sceneShotVideoTakes.id)
    )
    .where(and(
      eq(sceneShotVideoTakeImages.assetId, assetId),
      isNull(sceneShotVideoTakeImages.discardedAt),
      isNull(sceneShotVideoTakes.discardedAt)
    ))
    .all().length;
  return videoOwners + imageOwners;
}
