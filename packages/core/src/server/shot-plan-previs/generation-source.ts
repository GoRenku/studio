import { eq } from 'drizzle-orm';
import type { AttachGenerationMediaInput } from '../generation/attachments.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { listAssetsInSession } from '../assets/projection.js';
import { shotPlanPrevisRevisions } from '../schema/shot-plan-previs.js';
import { ProjectDataError } from '../project-data-error.js';

export function validatePrevisGenerationSource(session: DatabaseSession, input: AttachGenerationMediaInput): string | undefined {
  if (input.previsRevisionId === undefined) {
    return undefined;
  }
  const purposes = ['shot-plan.video-generation', 'image.create', 'shot-plan.video-reference',
    'shot-plan.video-first-frame', 'shot-plan.video-last-frame', 'shot-plan.video-storyboard'];
  if (!purposes.includes(input.purpose) || input.target?.kind !== 'shotPlan'
    || typeof input.previsRevisionId !== 'string' || !input.previsRevisionId) {
    throw new ProjectDataError('CORE_PREVIS_GENERATION_SOURCE_INVALID', 'A Previs revision requires a Shot Plan video or reference attachment.');
  }
  return requirePrevisRevisionForPlan(session, input.target.id, input.previsRevisionId);
}

export function requirePrevisRevisionForPlan(session: DatabaseSession, shotPlanId: string, revisionId: string): string {
  const plan = requireShotPlanRecord(session, shotPlanId);
  const revision = session.db.select().from(shotPlanPrevisRevisions)
    .where(eq(shotPlanPrevisRevisions.id, revisionId)).get();
  if (plan.type !== 'previs' || revision?.shotPlanId !== plan.id) {
    throw new ProjectDataError('CORE_PREVIS_GENERATION_SOURCE_INVALID', 'The supplied revision must belong to the target Previs plan.');
  }
  return revision.id;
}

export function listPrevisGenerations(session: DatabaseSession, shotPlanId: string) {
  return listAssetsInSession(session, { owner: { kind: 'project' }, type: 'shot_plan_video', mediaKind: 'video' })
    .filter((asset) => asset.authoredFrom?.id === shotPlanId && asset.authoredFrom.previsRevisionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
