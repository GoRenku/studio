import { asc, desc, eq } from 'drizzle-orm';
import { readPrevisDisplay } from './playback.js';
import { listPrevisGenerations } from './generation-source.js';
import type { ShotPlanPrevisReport } from '../../client/shot-plan-previs.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { joinProjectRelativePath } from '../files/project-relative-paths.js';
import { requireShotPlanStorageContext } from '../project-asset-files/destinations/shot-plan.js';
import { ProjectDataError } from '../project-data-error.js';
import { shotPlanPrevisRevisions } from '../schema/shot-plan-previs.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';

export function projectShotPlanPrevis(session: DatabaseSession, projectFolder: string, shotPlanId: string): ShotPlanPrevisReport {
  const plan = requireShotPlanRecord(session, shotPlanId);
  if (plan.type !== 'previs') {
    throw new ProjectDataError('CORE_SHOT_PLAN_TYPE_INVALID', 'This operation requires a Previs plan.');
  }
  const project = readProjectRecord(session)!;
  const root = requireShotPlanStorageContext(session, shotPlanId).root;
  const generations = listPrevisGenerations(session, shotPlanId);
  const rows = session.db.select().from(shotPlanPrevisRevisions)
    .where(eq(shotPlanPrevisRevisions.shotPlanId, shotPlanId))
    .orderBy(asc(shotPlanPrevisRevisions.number)).all();
  return {
    project: { projectName: project.projectName, projectFolder },
    shotPlanId,
    sourceDirectory: joinProjectRelativePath(root, 'previs', 'source'),
    revisions: rows.map((row) => {
      const render = readOwnedAsset(session, { owner: { kind: 'project' }, assetId: row.assetId });
      return {
        id: row.id, number: row.number, sourceDirectory: row.sourceDirectory, createdAt: row.createdAt, render,
        ...readPrevisDisplay(session, projectFolder, row.sourceDirectory),
        generations: generations.filter((asset) => asset.authoredFrom?.previsRevisionId === row.id),
      };
    }),
    resourceKeys: [studioSceneShotPlansResourceKey(plan.sceneId)],
  };
}

export function readLatestPrevisRender(session: DatabaseSession, shotPlanId: string) {
  const revision = session.db.select({ assetId: shotPlanPrevisRevisions.assetId }).from(shotPlanPrevisRevisions)
    .where(eq(shotPlanPrevisRevisions.shotPlanId, shotPlanId)).orderBy(desc(shotPlanPrevisRevisions.number)).limit(1).get();
  return revision ? readOwnedAsset(session, { owner: { kind: 'project' }, assetId: revision.assetId }) : null;
}
