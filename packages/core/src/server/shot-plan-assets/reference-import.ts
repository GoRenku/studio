import fs from 'node:fs';
import path from 'node:path';
import type { ImportShotPlanReferenceInput, ShotPlanReferenceImportReport } from '../../client/shot-plan-assets.js';
import { normalizeAssetMetadata } from '../assets/metadata.js';
import { createAssetMembership } from '../assets/ownership.js';
import { readOwnedAsset } from '../assets/projection.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { createProjectAssetFileWriteSet, persistProjectAssetFileSync, rollbackProjectAssetFileWriteSetSync } from '../project-asset-files/index.js';
import { assertResolvedPathInsideProject } from '../project-asset-files/path-guards.js';
import { validateProjectReferenceFileInput } from '../project-asset-files/reference-validation.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import { requirePrevisRevisionForPlan } from '../shot-plan-previs/generation-source.js';
import { studioShotPlanAssetsResourceKey } from '../studio-coordination/resource-keys.js';

const referenceFormats: Record<string, { kind: ImportShotPlanReferenceInput['mediaKind']; mimeType: string }> = {
  '.png': { kind: 'image', mimeType: 'image/png' },
  '.jpg': { kind: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { kind: 'image', mimeType: 'image/jpeg' },
  '.webp': { kind: 'image', mimeType: 'image/webp' },
  '.gif': { kind: 'image', mimeType: 'image/gif' },
  '.avif': { kind: 'image', mimeType: 'image/avif' },
  '.mp4': { kind: 'video', mimeType: 'video/mp4' },
  '.mov': { kind: 'video', mimeType: 'video/quicktime' },
  '.webm': { kind: 'video', mimeType: 'video/webm' },
  '.m4v': { kind: 'video', mimeType: 'video/mp4' },
  '.wav': { kind: 'audio', mimeType: 'audio/wav' },
  '.mp3': { kind: 'audio', mimeType: 'audio/mpeg' },
  '.m4a': { kind: 'audio', mimeType: 'audio/mp4' },
  '.ogg': { kind: 'audio', mimeType: 'audio/ogg' },
  '.flac': { kind: 'audio', mimeType: 'audio/flac' },
};

export async function importShotPlanReference(input: ImportShotPlanReferenceInput): Promise<ShotPlanReferenceImportReport> {
  return withProject(input, async ({ session, projectFolder }) => {
    const plan = requireShotPlanRecord(session, input.shotPlanId);
    if (typeof input.title !== 'string' || !input.title.trim()
      || typeof input.sourceProjectRelativePath !== 'string') {
      throw new ProjectDataError('CORE_SHOT_PLAN_REFERENCE_INVALID', 'Reference import requires a title and source path.');
    }
    if (plan.type === 'previs' && !input.previsRevisionId) {
      throw new ProjectDataError('CORE_PREVIS_GENERATION_SOURCE_INVALID', 'A Previs reference requires the exact revision.');
    }
    const revisionId = input.previsRevisionId === undefined ? undefined
      : requirePrevisRevisionForPlan(session, plan.id, input.previsRevisionId);
    const format = referenceFormats[path.extname(input.sourceProjectRelativePath).toLowerCase()];
    if (!format || format.kind !== input.mediaKind) {
      throw new ProjectDataError('CORE_SHOT_PLAN_REFERENCE_MEDIA_INVALID', 'Reference file extension must match the supplied image, video, or audio kind.');
    }
    const metadata = normalizeAssetMetadata({ oneLineSummary: input.summary });
    const source = await validateProjectReferenceFileInput({ projectFolder, projectRelativePath: input.sourceProjectRelativePath });
    assertResolvedPathInsideProject(fs.realpathSync(projectFolder), fs.realpathSync(source.absolutePath));
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
    }
    const ids = createRandomIdGenerator();
    const assetId = ids.next('asset');
    const now = new Date().toISOString();
    const writeSet = createProjectAssetFileWriteSet({ projectFolder });
    try {
      session.db.transaction((tx) => {
        const current = { ...session, db: tx };
        insertAssetRecord(current, {
          id: assetId, type: 'shot_plan_video_reference', mediaKind: input.mediaKind,
          title: input.title.trim(), oneLineSummary: metadata.oneLineSummary ?? undefined, origin: 'external', availability: 'ready',
          authoredFromShotPlanId: plan.id, previsRevisionId: revisionId, createdAt: now, updatedAt: now,
        });
        createAssetMembership(current, { assetId, owner: { kind: 'project' }, now });
        persistProjectAssetFileSync({
          session: current, projectFolder, writeSet, assetId, assetFileId: ids.next('asset_file'),
          sourceProjectRelativePath: source.projectRelativePath,
          destination: { kind: 'shotPlan.videoReference', shotPlanId: plan.id, role: 'reference' },
          namingMode: { kind: 'external' }, fileRole: 'primary', mediaKind: input.mediaKind,
          mimeType: format.mimeType, now,
        });
      });
      writeSet.markCommitted();
    } catch (error) {
      rollbackProjectAssetFileWriteSetSync(writeSet);
      if (error instanceof ProjectDataError) {
        throw error;
      }
      throw new ProjectDataError('CORE_SHOT_PLAN_REFERENCE_IMPORT_FAILED', `Reference import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const asset = readOwnedAsset(session, { owner: { kind: 'project' }, assetId });
    if (!asset) {
      throw new ProjectDataError('CORE_SHOT_PLAN_REFERENCE_IMPORT_FAILED', 'Imported reference could not be read.');
    }
    return { valid: true, asset, resourceKeys: [studioShotPlanAssetsResourceKey(plan.id)],
      project: { projectName: project.projectName, id: project.id, projectFolder } };
  });
}
