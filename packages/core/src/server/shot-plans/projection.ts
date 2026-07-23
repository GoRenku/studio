import {
  createDiagnosticWarning,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { eq } from 'drizzle-orm';
import type { AssetFile } from '../../client/assets.js';
import type {
  ShotPlan,
  ShotPlanListReport,
  ShotPlanReport,
} from '../../client/shot-plans.js';
import { readAssetRecord } from '../database/access/assets.js';
import { listAssetFileRecordsForAsset } from '../database/access/asset-files.js';
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
  const video = projectVideoFile(session, record);
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
      generationSpec:
        record.generationSpecId === null
          ? null
          : readGenerationSpec({ id: record.generationSpecId, session }),
      videoAssetId: record.videoAssetId,
      videoAssetFile: video.file,
      videoAttachedAt: record.videoAttachedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    warnings: video.warnings,
  };
}

function projectVideoFile(
  session: DatabaseSession,
  record: ShotPlanRecord
): { file: AssetFile | null; warnings: DiagnosticIssue[] } {
  if (record.videoAssetId === null) {
    return { file: null, warnings: [] };
  }
  const asset = readAssetRecord(session, record.videoAssetId);
  const file =
    asset && asset.discardedAt === null
      ? listAssetFileRecordsForAsset(session, asset.id).find(
          (candidate) => candidate.role === 'primary'
        ) ?? null
      : null;
  if (!file) {
    return {
      file: null,
      warnings: [
        createDiagnosticWarning(
          'CORE_SHOT_PLAN_VIDEO_UNAVAILABLE',
          `Shot Plan video Asset is unavailable: ${record.videoAssetId}.`,
          { path: ['shotPlan', record.id, 'videoAssetId'] }
        ),
      ],
    };
  }
  return {
    file: {
      id: file.id,
      role: file.role,
      projectRelativePath: file.projectRelativePath as AssetFile['projectRelativePath'],
      mediaKind: file.mediaKind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      contentHash: file.contentHash,
      width: file.width,
      height: file.height,
      durationSeconds: file.durationSeconds,
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
