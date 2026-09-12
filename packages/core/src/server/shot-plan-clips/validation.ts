import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assets, assetFiles } from '../schema/assets.js';
import { ProjectDataError } from '../project-data-error.js';
import { requireClip, requireClipRevision, requireTake, requireIdentity } from './records.js';
import type { RegisterShotPlanClipTakeInput } from '../../client/shot-plan-clips.js';

export function validateTakeTitle(title: unknown) {
  if (title !== undefined && title !== null && typeof title !== 'string') {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Take title must be text or null.');
  }
}

export function requireActiveTakeFile(session: DatabaseSession, assetId: string, fileId: string) {
  requireIdentity(assetId);
  requireIdentity(fileId);
  const asset = session.db.select().from(assets).where(eq(assets.id, assetId)).get();
  const file = session.db.select().from(assetFiles).where(eq(assetFiles.id, fileId)).get();
  if (!asset || !file || file.assetId !== asset.id || asset.discardedAt || file.discardedAt
    || asset.availability !== 'ready' || file.mediaKind !== 'video' || asset.type !== 'shot_plan_video') {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'Choose an active Shot Plan video file belonging to the supplied Asset.');
  }
  return { asset, file };
}

export function validateTakeRegistration(session: DatabaseSession, input: RegisterShotPlanClipTakeInput) {
  validateTakeTitle(input.title);
  const clip = requireClip(session, input.clipId);
  const revision = requireClipRevision(session, clip.previsRevisionId);
  const { asset } = requireActiveTakeFile(session, input.assetId, input.assetFileId);
  if (asset.authoredFromShotPlanId !== revision.shotPlanId || asset.previsRevisionId !== revision.id) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'The video must belong to the clip’s Shot Plan and Previs revision.');
  }
  if (input.sourceTakeId !== undefined && input.sourceTakeId !== null) {
    requireTake(session, input.sourceTakeId);
  }
  return { clip, revision };
}
