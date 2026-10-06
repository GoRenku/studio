import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { assetFiles } from '../../../schema/asset-files.js';
import { projects } from '../../../schema/project.js';
import { readProjectRecord } from '../../access/project.js';
import { listInspirationFolderRecordsIncludingDiscarded } from '../../access/inspiration-folders.js';
import { readAssetFileRecordByPath } from '../../access/asset-files.js';
import { resolveProjectRelativePath } from '../../../files/project-relative-paths.js';
import { hashFileSync, mimeTypeForProjectPath, referenceMediaKindForProjectPath } from '../../../project-asset-files/file-operations.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { createProjectDatabasePreMigrationBackup } from '../project-database-backups.js';
import type { ProjectDatabasePreMigrationBackupReport } from '../project-database-backups.js';
import type { DatabaseSession } from '../store.js';
import { discoverAssetFileBackfillCandidates } from './candidates.js';
import { projectUpgradeFailure } from '../project-upgrade-errors.js';

export function completeAssetFileBackfill(input: {
  session: DatabaseSession;
  projectFolder: string;
  preMigrationBackup?: ProjectDatabasePreMigrationBackupReport | null;
}): void {
  const project = readProjectRecord(input.session);
  if (!project || project.assetFileBackfillVersion === 1) { return; }
  const candidates = discoverAssetFileBackfillCandidates(input);
  const folders = listInspirationFolderRecordsIncludingDiscarded(input.session);
  const issues: DiagnosticIssue[] = [];
  const physicalFacts: { id: string; sizeBytes: number; contentHash: string; mimeType: string }[] = [];
  const now = new Date().toISOString();
  const records = candidates.flatMap((candidate) => {
    try {
      const absolute = resolveProjectRelativePath(input.projectFolder, candidate.projectRelativePath);
      const stats = fs.lstatSync(absolute);
      if (!stats.isFile() || stats.isSymbolicLink()) { throw new TypeError('Reference must be a regular file.'); }
      const contentHash = hashFileSync(absolute);
      const mediaKind = referenceMediaKindForProjectPath(candidate.projectRelativePath);
      const existing = readAssetFileRecordByPath(input.session, candidate.projectRelativePath);
      if (existing) {
        if (existing.ownerKey !== candidate.ownerKey || existing.type !== candidate.type
          || (existing.contentHash !== null && existing.contentHash !== contentHash)) {
          throw new TypeError('Registered reference identity conflicts with this path or its bytes.');
        }
        if (existing.contentHash === null) { physicalFacts.push({ id: existing.id, sizeBytes: stats.size, contentHash,
          mimeType: mimeTypeForProjectPath(candidate.projectRelativePath, mediaKind) }); }
        return [];
      }
      const folder = folders.find((folder) => candidate.ownerKey === `inspirationFolder:${encodeURIComponent(folder.id)}`);
      return [{
        ...candidate, id: `asset_file_${randomUUID()}`, title: null, origin: 'imported',
        mediaKind, availability: 'ready', mimeType: mimeTypeForProjectPath(candidate.projectRelativePath, mediaKind),
        sizeBytes: stats.size, contentHash, createdAt: now, updatedAt: now,
        discardedAt: folder?.discardedAt ?? null, discardOperationId: folder?.discardOperationId ?? null,
        restoredAt: folder?.restoredAt ?? null,
      }];
    } catch (error) {
      issues.push(createDiagnosticError('PROJECT_ASSET_FILE_BACKFILL_FAILED',
        error instanceof Error ? error.message : String(error),
        { path: ['projectRelativePath', candidate.projectRelativePath] }));
      return [];
    }
  });
  if (issues.length) { throw new ProjectDataError('PROJECT_ASSET_FILE_BACKFILL_FAILED',
    'Retained reference registration could not finish.', { issues }); }
  const backup = input.preMigrationBackup ?? createProjectDatabasePreMigrationBackup(input.session.databasePath);
  try {
    input.session.db.transaction((tx) => {
      if (readProjectRecord({ ...input.session, db: tx })?.assetFileBackfillVersion === 1) { return; }
      for (const record of records) { tx.insert(assetFiles).values(record).run(); }
      for (const { id, ...facts } of physicalFacts) { tx.update(assetFiles).set(facts).where(eq(assetFiles.id, id)).run(); }
      tx.update(projects).set({ assetFileBackfillVersion: 1 }).where(eq(projects.id, project.id)).run();
    }, { behavior: 'immediate' });
  } catch (error) {
    throw projectUpgradeFailure(error, backup, 'reference registration transaction failed');
  }
}
