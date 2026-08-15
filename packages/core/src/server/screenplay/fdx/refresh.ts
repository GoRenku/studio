import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import { commitProjectAssetFileWriteSet } from '../../project-asset-files/index.js';
import type { ProjectAssetFileWriteSet } from '../../project-asset-files/types.js';
import { insertScreenplayRevision, readLatestScreenplayRevisionSummary } from '../persistence/revisions.js';
import { replaceScreenplayAggregate } from '../persistence/screenplay.js';
import { readScreenplaySubjectIds } from '../persistence/references.js';
import { assertValidScreenplay } from '../validation/blocks.js';
import {
  retainCurrentFdxScreenplayWhenEqual,
  reuseUniqueUnchangedFdxScenes,
} from './content-identity.js';
import type { ImportFdxScreenplayReport, ScreenplayImport } from './contracts.js';
import { FdxIdentityFactory } from './identifiers.js';
import type { MappedFdxScreenplay } from './mapping/screenplay.js';
import { updateScreenplayImport } from './persistence/import-record.js';
import { persistFdxSourceAsset } from './persistence/source-asset.js';
import { createFdxImportReport, screenplayFdxResourceKeys } from './report.js';
import type { FdxSource } from './source.js';

export function refreshFdxScreenplay(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  project: { id: string; projectName: string };
  source: FdxSource;
  mapped: MappedFdxScreenplay;
  currentImport: ScreenplayImport;
  current: MappedFdxScreenplay['screenplay'];
}): ImportFdxScreenplayReport {
  const currentSourceSha256 = requireImportSourceSha256(input.session, input.currentImport);
  if (!readLatestScreenplayRevisionSummary(input.session)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      'FDX-backed Screenplay has no current Screenplay Revision.',
    );
  }

  const equal = retainCurrentFdxScreenplayWhenEqual({
    current: input.current,
    proposed: input.mapped.screenplay,
    candidates: input.mapped.candidates,
  });
  if (input.source.sha256 === currentSourceSha256) {
    return createFdxImportReport({
      status: 'unchanged',
      project: input.project,
      source: input.source,
      screenplayImport: input.currentImport,
      mapped: equal ? { ...input.mapped, candidates: equal.candidates } : input.mapped,
      resourceKeys: [],
    });
  }

  const nextImport = createNextImport(input.currentImport, input.source, input.mapped.technicalLog);
  if (equal) {
    persistSourceOnlyRefresh({
      session: input.session,
      projectFolder: input.projectFolder,
      writeSet: input.writeSet,
      source: input.source,
      screenplayImport: nextImport,
    });
    commitProjectAssetFileWriteSet(input.writeSet);
    return createFdxImportReport({
      status: 'refreshed',
      project: input.project,
      source: input.source,
      screenplayImport: nextImport,
      mapped: { ...input.mapped, candidates: equal.candidates },
      resourceKeys: [],
    });
  }

  const reused = reuseUniqueUnchangedFdxScenes({
    current: input.current,
    proposed: input.mapped.screenplay,
    candidates: input.mapped.candidates,
  });
  assertValidScreenplay(reused.screenplay, {
    subjects: readScreenplaySubjectIds(input.session),
    context: 'source-authoritative FDX Screenplay',
  });
  const now = nextImport.importedAt;
  const nextRevisionId = createUniqueIdAllocator(createRandomIdGenerator())('screenplay_revision');
  persistSemanticRefresh({
    session: input.session,
    projectFolder: input.projectFolder,
    writeSet: input.writeSet,
    source: input.source,
    screenplayImport: nextImport,
    screenplay: reused.screenplay,
    revisionId: nextRevisionId,
    now,
  });
  commitProjectAssetFileWriteSet(input.writeSet);
  return createFdxImportReport({
    status: 'refreshed',
    project: input.project,
    source: input.source,
    screenplayImport: nextImport,
    mapped: { ...input.mapped, candidates: reused.candidates },
    resourceKeys: screenplayFdxResourceKeys(),
  });
}

function createNextImport(
  current: ScreenplayImport,
  source: FdxSource,
  technicalLog: ScreenplayImport['technicalLog'],
): ScreenplayImport {
  const identities = new FdxIdentityFactory(source.sha256);
  return {
    ...current,
    sourceAssetId: identities.id('asset', 'sourceAsset'),
    sourceAssetFileId: identities.id('asset_file', 'sourceAsset/file'),
    importedAt: new Date().toISOString(),
    technicalLog,
  };
}

function persistSourceOnlyRefresh(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  source: FdxSource;
  screenplayImport: ScreenplayImport;
}): void {
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    persistFdxSourceAsset({
      session: txSession,
      projectFolder: input.projectFolder,
      source: input.source,
      assetId: input.screenplayImport.sourceAssetId,
      assetFileId: input.screenplayImport.sourceAssetFileId,
      now: input.screenplayImport.importedAt,
      writeSet: input.writeSet,
    });
    updateScreenplayImport(txSession, input.screenplayImport);
  });
}

function persistSemanticRefresh(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  source: FdxSource;
  screenplayImport: ScreenplayImport;
  screenplay: MappedFdxScreenplay['screenplay'];
  revisionId: string;
  now: string;
}): void {
  input.session.db.transaction((tx) => {
    const txSession = { ...input.session, db: tx };
    persistFdxSourceAsset({
      session: txSession,
      projectFolder: input.projectFolder,
      source: input.source,
      assetId: input.screenplayImport.sourceAssetId,
      assetFileId: input.screenplayImport.sourceAssetFileId,
      now: input.now,
      writeSet: input.writeSet,
    });
    replaceScreenplayAggregate(txSession, input.screenplay);
    updateScreenplayImport(txSession, input.screenplayImport);
    insertScreenplayRevision({
      session: txSession,
      id: input.revisionId,
      screenplay: input.screenplay,
      sourceCommand: 'screenplay.import-fdx',
      createdAt: input.now,
    });
  });
}

function requireImportSourceSha256(session: DatabaseSession, screenplayImport: ScreenplayImport): string {
  const file = readAssetFileRecordIncludingDiscarded(session, {
    assetId: screenplayImport.sourceAssetId,
    assetFileId: screenplayImport.sourceAssetFileId,
  });
  if (!file?.contentHash?.match(/^[0-9a-f]{64}$/u)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      'Screenplay Import retained source hash is unavailable.',
    );
  }
  return file.contentHash;
}
