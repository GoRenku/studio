import { and, eq, isNull } from 'drizzle-orm';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  sceneShotVideoTakeImages,
  sceneShotVideoTakeVideos,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export type ShotVideoTakeImageRole = 'first-frame' | 'last-frame' | 'video-prompt';

export function requireShotVideoTakeAuthoringMutable(input: {
  session: DatabaseSession;
  takeId: string;
}): void {
  const image = input.session.db
    .select({ takeId: sceneShotVideoTakeImages.takeId })
    .from(sceneShotVideoTakeImages)
    .where(and(
      eq(sceneShotVideoTakeImages.takeId, input.takeId),
      isNull(sceneShotVideoTakeImages.discardedAt)
    ))
    .get();
  const video = input.session.db
    .select({ takeId: sceneShotVideoTakeVideos.takeId })
    .from(sceneShotVideoTakeVideos)
    .where(and(
      eq(sceneShotVideoTakeVideos.takeId, input.takeId),
      isNull(sceneShotVideoTakeVideos.discardedAt)
    ))
    .get();
  if (image || video) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_AUTHORING_IMMUTABLE',
      'This Shot Video Take already has generated media. Create a new Take before changing its shots, direction, generation setup, or references.'
    );
  }
}

export function insertShotVideoTakeImage(input: {
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
  if (existing) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_TAKE_IMAGE_ALREADY_ATTACHED',
      `Shot Video Take already owns a current ${input.role} image.`
    );
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

export function insertShotVideoTakeVideo(input: {
  session: DatabaseSession;
  takeId: string;
  assetId: string;
  assetFileId: string;
  now: string;
}): void {
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
}
