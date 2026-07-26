import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { eq } from 'drizzle-orm';
import type {
  ShotPlan,
  ShotPlanListReport,
  ShotPlanReport,
} from '../../client/shot-plans.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotPlanRecords,
  requireShotPlanRecord,
  type ShotPlanRecord,
} from '../database/access/shot-plans/plan-records.js';
import { readShotRepresentativeAssetId } from '../database/access/shot-plans/image-records.js';
import { listShotRecords } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readGenerationSpec } from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import { scenes } from '../schema/index.js';
import { studioSceneShotPlansResourceKey } from '../studio-coordination/resource-keys.js';
import { resolveShotPlanBeatContext } from './beat-context.js';
import {
  parseStoredShotBrief,
  parseStoredShotPlanCoverage,
} from './validation.js';

export function projectShotPlanReport(input: {
  session: DatabaseSession;
  projectFolder: string;
  shotPlanId: string;
}): ShotPlanReport {
  const record = requireShotPlanRecord(input.session, input.shotPlanId);
  const projection = projectShotPlan(input.session, record);
  const beatContext = resolveShotPlanBeatContext({
    session: input.session,
    sceneId: record.sceneId,
    coverage: projection.shotPlan.coverage,
  });
  return {
    valid: true,
    project: projectReport(input),
    shotPlan: projection.shotPlan,
    coveredBeats: beatContext.coveredBeats,
    warnings: [
      ...projection.warnings,
      ...beatContext.warnings,
      ...sceneWarnings(input.session, record.sceneId),
    ],
    resourceKeys: [studioSceneShotPlansResourceKey(record.sceneId)],
  };
}

export function projectSceneShotPlanListReport(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
}): ShotPlanListReport {
  const projected = listSceneShotPlanRecords(input.session, input.sceneId).map(
    (record) => {
      const projection = projectShotPlan(input.session, record);
      const beatContext = resolveShotPlanBeatContext({
        session: input.session,
        sceneId: record.sceneId,
        coverage: projection.shotPlan.coverage,
      });
      return { ...projection, beatContext };
    }
  );
  return {
    valid: true,
    project: projectReport(input),
    shotPlans: projected.map((item) => ({
      shotPlan: item.shotPlan,
      coveredBeats: item.beatContext.coveredBeats,
    })),
    warnings: [
      ...projected.flatMap((item) => item.warnings),
      ...projected.flatMap((item) => item.beatContext.warnings),
      ...sceneWarnings(input.session, input.sceneId),
    ],
    resourceKeys: [studioSceneShotPlansResourceKey(input.sceneId)],
  };
}

function projectShotPlan(
  session: DatabaseSession,
  record: ShotPlanRecord
): { shotPlan: ShotPlan; warnings: DiagnosticIssue[] } {
  const coverage = parseStoredShotPlanCoverage(record.coverage, record.id);
  return {
    shotPlan: {
      id: record.id,
      sceneId: record.sceneId,
      title: record.title,
      coverage,
      shots: listShotRecords(session, record.id).map((shot) => ({
        id: shot.id,
        position: shot.position,
        title: shot.title,
        description: shot.description,
        brief: parseStoredShotBrief(shot.brief, shot.id),
        representativeImage: projectRepresentativeImage(session, shot.id),
      })),
      lastGenerationSpec:
        record.lastGenerationSpecId === null
          ? null
          : readGenerationSpec({ id: record.lastGenerationSpecId, session }),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    warnings: [],
  };
}

function projectRepresentativeImage(
  session: DatabaseSession,
  shotId: string
) {
  const assetId = readShotRepresentativeAssetId(session, shotId);
  if (!assetId) {
    return null;
  }
  const asset = readAssetRelationship(session, {
    target: { kind: 'shot', shotId },
    assetId,
  });
  if (!asset || asset.role !== 'shot-image') {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_STORAGE_INVALID',
      `Shot ${shotId} selects Asset ${assetId}, but it is not an active shot-image candidate.`
    );
  }
  return asset;
}

function projectReport(input: {
  session: DatabaseSession;
  projectFolder: string;
}): ShotPlanReport['project'] {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${input.session.databasePath}.`
    );
  }
  return {
    name: project.name,
    id: project.id,
    projectFolder: input.projectFolder,
  };
}

function sceneWarnings(
  session: DatabaseSession,
  sceneId: string
): DiagnosticIssue[] {
  const scene = session.db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .get();
  return scene
    ? []
    : [
        createDiagnosticWarning(
          'CORE_SHOT_PLAN_SCENE_MISSING',
          `Shot Plan Scene is unavailable: ${sceneId}.`,
          { path: ['shotPlan', 'sceneId'] }
        ),
      ];
}
