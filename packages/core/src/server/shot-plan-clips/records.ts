import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { shotPlanClips, shotPlanClipTakes } from '../schema/shot-plan-clips.js';
import { shotPlanPrevisRevisions } from '../schema/shot-plan-previs.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { ProjectDataError } from '../project-data-error.js';

export function requireClip(session: DatabaseSession, id: string) {
  requireIdentity(id);
  const clip = session.db.select().from(shotPlanClips).where(eq(shotPlanClips.id, id)).get();
  if (!clip) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_NOT_FOUND', 'The clip does not exist.');
  }
  return clip;
}

export function requireTake(session: DatabaseSession, id: string) {
  requireIdentity(id);
  const take = session.db.select().from(shotPlanClipTakes).where(eq(shotPlanClipTakes.id, id)).get();
  if (!take) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_NOT_FOUND', 'The clip take does not exist.');
  }
  return take;
}

export function requireClipRevision(session: DatabaseSession, revisionId: string, shotPlanId?: string) {
  requireIdentity(revisionId);
  const revision = session.db.select().from(shotPlanPrevisRevisions).where(eq(shotPlanPrevisRevisions.id, revisionId)).get();
  if (!revision || (shotPlanId !== undefined && revision.shotPlanId !== shotPlanId)) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_NOT_FOUND', 'The Previs revision does not belong to this Shot Plan.');
  }
  requireShotPlanRecord(session, revision.shotPlanId);
  return revision;
}

export function requireIdentity(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ProjectDataError('CORE_SHOT_PLAN_CLIP_TAKE_INVALID', 'A non-empty identity is required.');
  }
}
