import { shotPlanPrevisRevisions } from '../schema/shot-plan-previs.js';
import { shotPlans } from '../schema/shot-plans.js';
import { asc, eq, inArray } from 'drizzle-orm';
import type { ShotPlanClips } from '../../client/shot-plan-clips.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { shotPlanClips, shotPlanClipTakes } from '../schema/shot-plan-clips.js';
import { listPrevisGenerations } from '../shot-plan-previs/generation-source.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';
import { requireClip, requireClipRevision, requireTake } from './records.js';

export function projectShotPlanClips(session: DatabaseSession, shotPlanId: string, previsRevisionId: string): ShotPlanClips {
  requireClipRevision(session, previsRevisionId, shotPlanId);
  const plan = requireShotPlanRecord(session, shotPlanId);
  const clips = session.db.select().from(shotPlanClips).where(eq(shotPlanClips.previsRevisionId, previsRevisionId)).orderBy(asc(shotPlanClips.number)).all();
  const takes = clips.length ? session.db.select().from(shotPlanClipTakes).where(inArray(shotPlanClipTakes.clipId, clips.map((clip) => clip.id))).orderBy(asc(shotPlanClipTakes.number)).all() : [];
  const videos = listPrevisGenerations(session, shotPlanId).filter((asset) => asset.authoredFrom?.previsRevisionId === previsRevisionId);
  const assigned = new Set(takes.map((take) => take.assetId));
  const assignedFiles = new Set(takes.map((take) => take.assetFileId));
  const sources = [...new Set(takes.flatMap((take) => take.sourceTakeId ? [take.sourceTakeId] : []))].map((id) => {
    const take = requireTake(session, id);
    const clip = requireClip(session, take.clipId);
    const revision = session.db.select().from(shotPlanPrevisRevisions).where(eq(shotPlanPrevisRevisions.id, clip.previsRevisionId)).get()!;
    const sourcePlan = session.db.select().from(shotPlans).where(eq(shotPlans.id, revision.shotPlanId)).get()!;
    return { takeId: id, shotPlanId: revision.shotPlanId, shotPlanTitle: sourcePlan.title, revisionNumber: revision.number, clipNumber: clip.number,
      takeNumber: take.number, selectedTakeNumber: clip.selectedTakeId ? requireTake(session, clip.selectedTakeId).number : null };
  });
  return {
    project: { projectName: readProjectRecord(session)!.projectName }, shotPlanId, previsRevisionId,
    clips: clips.map((clip) => ({ id: clip.id, previsRevisionId: clip.previsRevisionId, number: clip.number, selectedTakeId: clip.selectedTakeId, takes: takes.filter((take) => take.clipId === clip.id) })),
    assets: videos.filter((asset) => assigned.has(asset.id)), unassignedAssets: videos.map((asset) => ({ ...asset, files: asset.files.filter((file) => file.mediaKind === 'video' && !assignedFiles.has(file.id)) })).filter((asset) => asset.files.length > 0),
    sources, resourceKeys: [studioSceneShotPlansResourceKey(plan.sceneId)],
  };
}
