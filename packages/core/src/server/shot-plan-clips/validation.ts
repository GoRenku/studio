import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assetFiles } from '../schema/asset-files.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireClip, requireClipRevision, requireTake, requireIdentity } from './records.js';
import type { RegisterShotPlanClipTakeInput } from '../../client/shot-plan-clips.js';

export function validateTakeTitle(title: unknown) {
  if (title !== undefined && title !== null && typeof title !== 'string') {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Take title must be text or null.');
  }
}

export function requireActiveTakeFile(session: DatabaseSession, assetFileId: string) {
  requireIdentity(assetFileId);
  const assetFile = session.db.select().from(assetFiles).where(eq(assetFiles.id, assetFileId)).get();
  if (!assetFile || assetFile.discardedAt || assetFile.ownerKey !== 'project'
    || assetFile.availability !== 'ready' || assetFile.mediaKind !== 'video' || assetFile.type !== 'shot_plan_video') {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Choose an active Project-owned Shot Plan video file.');
  }
  return assetFile;
}

export function validateTakeRegistration(session: DatabaseSession, input: RegisterShotPlanClipTakeInput) {
  validateTakeTitle(input.title);
  const clip = requireClip(session, input.clipId);
  const revision = requireClipRevision(session, clip.previsRevisionId);
  const assetFile = requireActiveTakeFile(session, input.assetFileId);
  if (assetFile.authoredFromShotPlanId !== revision.shotPlanId || assetFile.previsRevisionId !== revision.id) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'The video must belong to the clip’s Shot Plan and Previs revision.');
  }
  if (input.sourceTakeId !== undefined && input.sourceTakeId !== null) {
    requireTake(session, input.sourceTakeId);
  }
  return { clip, revision };
}
