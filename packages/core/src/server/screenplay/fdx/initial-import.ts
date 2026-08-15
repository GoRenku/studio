import { createRandomIdGenerator, createUniqueIdAllocator } from '../../entity-ids.js';
import { commitProjectAssetFileWriteSet } from '../../project-asset-files/index.js';
import type { ProjectAssetFileWriteSet } from '../../project-asset-files/types.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { insertScreenplayRevision } from '../persistence/revisions.js';
import { replaceScreenplayAggregate } from '../persistence/screenplay.js';
import { readScreenplaySubjectIds } from '../persistence/references.js';
import { assertValidScreenplay } from '../validation/blocks.js';
import { FDX_IMPORTER_VERSION, type ImportFdxScreenplayReport, type ScreenplayImport } from './contracts.js';
import { FdxIdentityFactory } from './identifiers.js';
import type { MappedFdxScreenplay } from './mapping/screenplay.js';
import { insertScreenplayImport } from './persistence/import-record.js';
import { persistFdxSourceAsset } from './persistence/source-asset.js';
import { createFdxImportReport, screenplayFdxResourceKeys } from './report.js';
import type { FdxSource } from './source.js';

export function applyInitialFdxImport(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  project: { id: string; projectName: string };
  source: FdxSource;
  mapped: MappedFdxScreenplay;
}): ImportFdxScreenplayReport {
  assertValidScreenplay(input.mapped.screenplay, {
    subjects: readScreenplaySubjectIds(input.session),
    context: 'mapped FDX Screenplay',
  });
  const identities = new FdxIdentityFactory(input.source.sha256);
  const now = new Date().toISOString();
  const screenplayImport: ScreenplayImport = {
    id: identities.id('screenplay_import', 'import'),
    sourceAssetId: identities.id('asset', 'sourceAsset'),
    sourceAssetFileId: identities.id('asset_file', 'sourceAsset/file'),
    importerVersion: FDX_IMPORTER_VERSION,
    importedAt: now,
    technicalLog: input.mapped.technicalLog,
  };
  const revisionId = createUniqueIdAllocator(createRandomIdGenerator())('screenplay_revision');
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    persistFdxSourceAsset({
      session: txSession,
      projectFolder: input.projectFolder,
      source: input.source,
      assetId: screenplayImport.sourceAssetId,
      assetFileId: screenplayImport.sourceAssetFileId,
      now,
      writeSet: input.writeSet,
    });
    insertScreenplayImport(txSession, screenplayImport);
    replaceScreenplayAggregate(txSession, input.mapped.screenplay);
    insertScreenplayRevision({
      session: txSession,
      id: revisionId,
      screenplay: input.mapped.screenplay,
      sourceCommand: 'screenplay.import-fdx',
      createdAt: now,
    });
  });
  commitProjectAssetFileWriteSet(input.writeSet);
  return createFdxImportReport({
    status: 'imported',
    project: input.project,
    source: input.source,
    screenplayImport,
    mapped: input.mapped,
    resourceKeys: screenplayFdxResourceKeys(),
  });
}
