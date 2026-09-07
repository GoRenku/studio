import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ProjectAssetFileWriteSet } from '../../project-asset-files/types.js';
import { readLatestScreenplayRevisionSummary } from '../persistence/revisions.js';
import { readScreenplaySubjectIds } from '../persistence/references.js';
import { assertValidScreenplay } from '../validation/blocks.js';
import {
  retainCurrentFdxScreenplayWhenEqual,
  reuseUniqueUnchangedFdxScenes,
} from './content-identity.js';
import type { ImportFdxScreenplayReport, ScreenplayImport } from './contracts.js';
import { FdxIdentityFactory } from './identifiers.js';
import type { MappedFdxScreenplay } from './mapping/screenplay.js';
import { readScreenplayImport, requireImportSourceSha256 } from './persistence/import-record.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { persistSourceOnlyRefresh, persistSemanticRefresh } from './persistence/refresh.js';
import { buildFdxUpdateReview } from './update-review.js';
import {
  assertRetainedFdxSourceAsset,
} from './persistence/source-asset.js';
import { createFdxImportReport, screenplayFdxResourceKeys } from './report.js';
import type { FdxSource } from './source.js';

export function refreshFdxScreenplay(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  project: { id: string; projectName: string };
  source: FdxSource;
  mapped: MappedFdxScreenplay;
  reviewFingerprint?: string;
}): ImportFdxScreenplayReport {
  const currentImport = readScreenplayImport(input.session)!;
  const current = readCanonicalScreenplay(input.session);
  const currentSourceSha256 = requireImportSourceSha256(input.session, currentImport);
  if (!readLatestScreenplayRevisionSummary(input.session)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      'FDX-backed Screenplay has no current Screenplay Revision.',
    );
  }

  const equal = retainCurrentFdxScreenplayWhenEqual({
    current,
    proposed: input.mapped.screenplay,
    candidates: input.mapped.candidates,
  });
  if (input.source.sha256 === currentSourceSha256) {
    assertRetainedFdxSourceAsset({
      session: input.session,
      projectFolder: input.projectFolder,
      source: input.source,
      assetId: currentImport.sourceAssetId,
      assetFileId: currentImport.sourceAssetFileId,
    });
    return createFdxImportReport({
      status: 'unchanged',
      project: input.project,
      source: input.source,
      screenplayImport: currentImport,
      mapped: equal ? { ...input.mapped, candidates: equal.candidates } : input.mapped,
      resourceKeys: [],
    });
  }

  if (input.reviewFingerprint !== undefined
    && buildFdxUpdateReview(input).reviewFingerprint !== input.reviewFingerprint) {
    throw new ProjectDataError('SCREENPLAY_FDX_UPDATE_REVIEW_STALE',
      'The screenplay or its production impact changed. Review the latest export.');
  }

  const nextImport = createNextImport(currentImport, input.source, input.mapped.technicalLog);
  if (equal) {
    persistSourceOnlyRefresh({
      session: input.session,
      projectFolder: input.projectFolder,
      writeSet: input.writeSet,
      source: input.source,
      screenplayImport: nextImport,
    });
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
    current,
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
