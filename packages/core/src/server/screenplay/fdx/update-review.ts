import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FdxUpdateReview } from '../../../client/screenplay/fdx-updates.js';
import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import { screenplayAnalysis, screenplayAnalysisState } from '../../schema/screenplay-analysis.js';
import { readLatestScreenplayRevisionSummary } from '../persistence/revisions.js';
import { readScreenplaySubjectIds } from '../persistence/references.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';
import { assertValidScreenplay } from '../validation/blocks.js';
import { retainCurrentFdxScreenplayWhenEqual, reuseUniqueUnchangedFdxScenes } from './content-identity.js';
import { FDX_IMPORTER_VERSION } from './contracts.js';
import { readStableFdxExport, requireFdxImport, type FdxUpdateProjectInput } from './external-file.js';
import { mapFdxScreenplay, type MappedFdxScreenplay } from './mapping/screenplay.js';
import { parseFdxDocument } from './parser/document.js';
import { requireImportSourceSha256 } from './persistence/import-record.js';
import { decodeFdxSource, type FdxSource } from './source.js';
import { screenplayAnalysisFreshness } from '../../screenplay-analysis/freshness.js';
import { assertValidFdxUpdateReview } from './validation.js';
import { readFdxUpdateImpact } from './update-impact.js';

export async function reviewFdxUpdate(input: FdxUpdateProjectInput & { sourceSha256: string }): Promise<FdxUpdateReview> {
  const { session, projectFolder } = await openProjectSession(input);
  try {
    const accepted = requireImportSourceSha256(session, requireFdxImport(session));
    const candidate = await readStableFdxExport(session, projectFolder, accepted);
    if (candidate.sha256 !== input.sourceSha256) {
      throw sourceChanged();
    }
    const source = decodeFdxSource(candidate.exportPath, candidate.bytes);
    const mapped = mapFdxScreenplay(parseFdxDocument(source.xml), source.sha256);
    return session.db.transaction((tx) => buildFdxUpdateReview({ session: { ...session, db: tx }, source, mapped }));
  } finally {
    session.close();
  }
}

export function buildFdxUpdateReview(input: { session: DatabaseSession; source: FdxSource; mapped: MappedFdxScreenplay }): FdxUpdateReview {
  const { session, source, mapped } = input;
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no project row.');
  }
  const currentImport = requireFdxImport(session);
  const accepted = requireImportSourceSha256(session, currentImport);
  if (accepted === source.sha256) {
    throw sourceChanged();
  }
  const current = readCanonicalScreenplay(session);
  const equal = retainCurrentFdxScreenplayWhenEqual({ current, proposed: mapped.screenplay, candidates: mapped.candidates });
  const final = equal ?? reuseUniqueUnchangedFdxScenes({ current, proposed: mapped.screenplay, candidates: mapped.candidates });
  assertValidScreenplay(final.screenplay, { subjects: readScreenplaySubjectIds(session), context: 'reviewed FDX Screenplay' });
  const { impact, evidence } = readFdxUpdateImpact(session, current, final.screenplay);
  const revision = readLatestScreenplayRevisionSummary(session);
  if (!revision) {
    throw new ProjectDataError('SCREENPLAY_FDX_IMPORT_INVALID', 'FDX-backed Screenplay has no current revision.');
  }
  const analysis = session.db.select({ id: screenplayAnalysis.id, updatedAt: screenplayAnalysis.updatedAt })
    .from(screenplayAnalysisState).innerJoin(screenplayAnalysis, eq(screenplayAnalysis.id, screenplayAnalysisState.activeAnalysisId)).get();
  const review: Omit<FdxUpdateReview, 'reviewFingerprint'> = {
    sourceSha256: source.sha256,
    change: equal ? 'sourceOnly' : 'screenplay',
    ...impact,
    analysisNeedsRefresh: Boolean(analysis && (!equal || screenplayAnalysisFreshness(session, analysis) === 'needsRefresh')),
    diagnostics: impact.removedOrReplacedScenes.length === 0 ? [] : [{
      code: 'SCREENPLAY_FDX_UPDATE_REPLACES_SCENES', severity: 'warning', location: { path: ['screenplay', 'scenes'] },
      message: 'Existing Scene-linked work remains in history and is not attached to replacement Scenes, even for small dialogue edits.',
    }],
  };
  const reviewFingerprint = createHash('sha256').update(JSON.stringify({
    projectId: project.id,
    sourceSha256: source.sha256, importId: currentImport.id, accepted,
    importedAt: currentImport.importedAt, revision, importerVersion: FDX_IMPORTER_VERSION,
    review, evidence, analysis,
  })).digest('hex');
  const result = { ...review, reviewFingerprint };
  assertValidFdxUpdateReview(result);
  return result;
}

function sourceChanged() {
  return new ProjectDataError('SCREENPLAY_FDX_SOURCE_CHANGED', 'The exported screenplay changed or was already accepted.',
    { suggestion: 'Check for changes and review the latest export.' });
}
