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
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotPlanRecords,
  listShotRecords,
  requireShotPlanRecord,
  type ShotPlanRecord,
} from '../database/access/shot-plans.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readGenerationSpec } from '../generation/specs.js';
import { ProjectDataError } from '../project-data-error.js';
import { scenes } from '../schema/index.js';
import { studioSceneShotsResourceKey } from '../studio-coordination/resource-keys.js';
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
    resolvedBeats: beatContext.resolvedBeats,
    warnings: [
      ...projection.warnings,
      ...beatContext.warnings,
      ...sceneWarnings(input.session, record.sceneId),
    ],
    resourceKeys: [studioSceneShotsResourceKey(record.sceneId)],
  };
}

export function projectSceneShotPlanListReport(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
}): ShotPlanListReport {
  const projected = listSceneShotPlanRecords(input.session, input.sceneId).map(
    (record) => projectShotPlan(input.session, record)
  );
  return {
    valid: true,
    project: projectReport(input),
    shotPlans: projected.map((item) => item.shotPlan),
    warnings: [
      ...projected.flatMap((item) => item.warnings),
      ...projected.flatMap((item) =>
        resolveShotPlanBeatContext({
          session: input.session,
          sceneId: item.shotPlan.sceneId,
          coverage: item.shotPlan.coverage,
        }).warnings
      ),
      ...sceneWarnings(input.session, input.sceneId),
    ],
    resourceKeys: [studioSceneShotsResourceKey(input.sceneId)],
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
        description: shot.description,
        brief: parseStoredShotBrief(shot.brief, shot.id),
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
