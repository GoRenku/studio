import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ImportReferenceFilesInput, ReferenceFilesImportReport } from '../../client/asset-files.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readProjectRecord } from '../database/access/project.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { createProjectAssetFileWriteSet, rollbackProjectAssetFileWriteSetSync } from '../project-asset-files/write-set.js';
import { studioAssetFileOwnerSurfaceResourceKeys } from '../studio-coordination/resource-keys.js';
import { referenceDestination, readReferenceSource } from './sources.js';
import { persistReferenceFile } from './persistence.js';

export async function importReferenceFiles(input: ImportReferenceFilesInput): Promise<ReferenceFilesImportReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = referenceDestination(session, input.destination);
    if (!Array.isArray(input.files) || !input.files.length) { throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_INVALID', 'Provide at least one reference file.'); }
    const issues: DiagnosticIssue[] = [];
    const sources = input.files.flatMap((source, index) => {
      try { return [readReferenceSource(projectFolder, source, owner)]; }
      catch (error) {
        issues.push(createDiagnosticError('CORE_REFERENCE_FILE_SOURCE_INVALID', error instanceof Error ? error.message : String(error), { path: ['files', String(index), 'sourceProjectRelativePath'] }));
        return [];
      }
    });
    if (issues.length) { throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_INVALID', 'Reference files could not be imported.', { issues }); }
    const writeSet = createProjectAssetFileWriteSet({ projectFolder });
    const ids = createRandomIdGenerator();
    const now = new Date().toISOString();
    try {
      const assetFiles = session.db.transaction((tx) => {
        const transactionSession = { ...session, db: tx };
        const currentOwner = referenceDestination(transactionSession, input.destination);
        if (currentOwner.root !== owner.root) {
          throw new ProjectDataError('CORE_REFERENCE_FILE_CONFLICT', 'The reference destination changed during import.');
        }
        return sources.map((source) => persistReferenceFile({
          session: transactionSession, projectFolder, writeSet, source, owner: currentOwner,
          destination: input.destination, assetFileId: ids.next('asset_file'), now,
        }));
      }, { behavior: 'immediate' });
      writeSet.markCommitted();
      const project = readProjectRecord(session)!;
      return { valid: true, warnings: [], assetFiles,
        project: { projectName: project.projectName, id: project.id, projectFolder },
        resourceKeys: studioAssetFileOwnerSurfaceResourceKeys(owner.owner) };
    } catch (error) {
      rollbackProjectAssetFileWriteSetSync(writeSet);
      if (error instanceof ProjectDataError) { throw error; }
      throw new ProjectDataError('CORE_REFERENCE_FILE_IMPORT_FAILED', 'Reference import could not be committed.', { suggestion: error instanceof Error ? error.message : String(error) });
    }
  } finally { session.close(); }
}
