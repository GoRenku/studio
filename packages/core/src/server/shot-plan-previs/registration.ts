import fs from 'node:fs';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import { and, eq, max } from 'drizzle-orm';
import type { ReadShotPlanPrevisInput, RegisterShotPlanPrevisInput, ShotPlanPrevisReport } from '../../client/shot-plan-previs.js';
import { createAssetMembership } from '../assets/ownership.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { joinProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { createProjectAssetFileWriteSet, persistProjectAssetFileSync, rollbackProjectAssetFileWriteSetSync } from '../project-asset-files/index.js';
import { requireShotPlanStorageContext } from '../project-asset-files/destinations/shot-plan.js';
import { hashFileSync } from '../project-asset-files/file-operations.js';
import { inspectPrevisSource, copyPrevisSource } from '../project-asset-files/previs-sources.js';
import { validateProjectReferenceFileInput } from '../project-asset-files/reference-validation.js';
import { assertDurableProjectDirectorySync, assertResolvedPathInsideProject } from '../project-asset-files/path-guards.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import { shotPlanPrevisRevisions } from '../schema/shot-plan-previs.js';
import { projectShotPlanPrevis } from './projection.js';

export async function readShotPlanPrevis(input: ReadShotPlanPrevisInput) {
  return withProject(input, ({ session, projectFolder }) => projectShotPlanPrevis(session, projectFolder, input.shotPlanId));
}

export async function registerShotPlanPrevis(input: RegisterShotPlanPrevisInput) {
  return withProject(input, async ({ session, projectFolder }) => {
    if (typeof input.sourceDirectory !== 'string' || typeof input.renderPath !== 'string'
      || (input.title !== undefined && typeof input.title !== 'string')) {
      throw new ProjectDataError('CORE_PREVIS_REGISTRATION_INVALID', 'Registration requires sourceDirectory and renderPath strings, with an optional title.');
    }
    projectShotPlanPrevis(session, projectFolder, input.shotPlanId);
    if (path.extname(input.renderPath).toLowerCase() !== '.mp4') {
      throw new ProjectDataError('CORE_PREVIS_RENDER_INVALID', 'A completed Previs render must be an MP4 file.');
    }
    const render = await validateProjectReferenceFileInput({
      projectFolder, projectRelativePath: input.renderPath, mediaKind: 'video', role: 'primary',
    });
    assertResolvedPathInsideProject(fs.realpathSync(projectFolder), fs.realpathSync(render.absolutePath));
    const source = inspectPrevisSource(projectFolder, input.sourceDirectory);
    const renderHash = hashFileSync(render.absolutePath);
    const identical = session.db.select().from(shotPlanPrevisRevisions).where(and(
      eq(shotPlanPrevisRevisions.shotPlanId, input.shotPlanId),
      eq(shotPlanPrevisRevisions.sourceHash, source.hash),
      eq(shotPlanPrevisRevisions.renderHash, renderHash),
    )).get();
    if (identical) {
      const report = projectShotPlanPrevis(session, projectFolder, input.shotPlanId);
      await validatePrevisRetryRender(projectFolder, identical, report);
      return report;
    }
    const writeSet = createProjectAssetFileWriteSet({ projectFolder });
    let sourceDestination: ProjectRelativePath | undefined;
    try {
      session.db.transaction((tx) => {
        const current = { ...session, db: tx };
        const last = tx.select({ number: max(shotPlanPrevisRevisions.number) }).from(shotPlanPrevisRevisions)
          .where(eq(shotPlanPrevisRevisions.shotPlanId, input.shotPlanId)).get();
        const number = (last?.number ?? 0) + 1;
        const root = requireShotPlanStorageContext(current, input.shotPlanId).root;
        assertDurableProjectDirectorySync(projectFolder, path.join(projectFolder, root, 'previs', 'renders'));
        const destination = joinProjectRelativePath(root, 'previs', 'revisions', `r${String(number).padStart(3, '0')}`);
        copyPrevisSource({ projectFolder, destination, source, writeSet });
        sourceDestination = destination;
        const now = new Date().toISOString();
        const ids = createRandomIdGenerator();
        const assetId = ids.next('asset');
        insertAssetRecord(current, {
          id: assetId, type: 'shot_plan_previs', mediaKind: 'video', title: input.title?.trim() || `Previs revision ${number}`,
          origin: 'rendered', availability: 'ready', authoredFromShotPlanId: input.shotPlanId, createdAt: now, updatedAt: now,
        });
        createAssetMembership(current, { assetId, owner: { kind: 'project' }, now });
        const file = persistProjectAssetFileSync({
          session: current, projectFolder, writeSet, assetId, assetFileId: ids.next('asset_file'),
          sourceProjectRelativePath: input.renderPath, destination: { kind: 'shotPlan.previs', shotPlanId: input.shotPlanId },
          namingMode: { kind: 'generated' }, fileRole: 'primary', mediaKind: 'video', now,
        });
        if (file.contentHash !== renderHash) {
          throw new ProjectDataError('CORE_PREVIS_SOURCE_CHANGED', 'Render changed during registration.');
        }
        tx.insert(shotPlanPrevisRevisions).values({
          id: ids.next('previs_revision'), shotPlanId: input.shotPlanId, number,
          sourceDirectory: destination, sourceHash: source.hash, renderHash, assetId, createdAt: now,
        }).run();
      });
      writeSet.markCommitted();
    } catch (error) {
      rollbackProjectAssetFileWriteSetSync(writeSet);
      if (sourceDestination) {
        fs.rmSync(resolveProjectRelativePath(projectFolder, sourceDestination), { recursive: true, force: true });
      }
      if (error instanceof ProjectDataError) {
        throw error;
      }
      throw new ProjectDataError('CORE_PREVIS_REGISTRATION_FAILED', `Previs registration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return projectShotPlanPrevis(session, projectFolder, input.shotPlanId);
  });
}

async function validatePrevisRetryRender(
  projectFolder: string,
  revision: typeof shotPlanPrevisRevisions.$inferSelect,
  report: ShotPlanPrevisReport
): Promise<void> {
  const render = report.revisions.find((entry) => entry.id === revision.id)?.render;
  const file = render?.files.find((entry) => entry.role === 'primary' && entry.mediaKind === 'video');
  if (!file) {
    throw new ProjectDataError(
      'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE',
      `Previs revision ${revision.number} already matches this request, but its render Asset ${revision.assetId} has no active, available primary video.`,
      { suggestion: 'Restore the render Asset from Trash before retrying. If it cannot be restored, register the render in a new Previs plan.' }
    );
  }
  try {
    const retained = await validateProjectReferenceFileInput({
      projectFolder, projectRelativePath: file.projectRelativePath, mediaKind: 'video', role: 'primary',
    });
    assertResolvedPathInsideProject(fs.realpathSync(projectFolder), fs.realpathSync(retained.absolutePath));
    fs.accessSync(retained.absolutePath, fs.constants.R_OK);
  } catch {
    throw new ProjectDataError(
      'CORE_PREVIS_REVISION_RENDER_UNAVAILABLE',
      `Previs revision ${revision.number} already matches this request, but its retained render is unavailable: ${file.projectRelativePath}.`,
      { suggestion: 'Restore the retained render file at the recorded path and make it readable before retrying. If it cannot be restored, register the render in a new Previs plan.' }
    );
  }
}
