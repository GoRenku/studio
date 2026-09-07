import { readStableFdxExport, requireFdxImport, resolveFdxExportPath, type FdxUpdateProjectInput } from '../fdx/external-file.js';
import { requireImportSourceSha256 } from '../fdx/persistence/import-record.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../../project-asset-files/index.js';
import type {
  ImportFdxScreenplayInput,
  ImportFdxScreenplayReport,
} from '../fdx/contracts.js';
import { applyInitialFdxImport } from '../fdx/initial-import.js';
import { mapFdxScreenplay } from '../fdx/mapping/screenplay.js';
import { parseFdxDocument } from '../fdx/parser/document.js';
import { readScreenplayImport } from '../fdx/persistence/import-record.js';
import { refreshFdxScreenplay } from '../fdx/refresh.js';
import { decodeFdxSource, readFdxSourceBytes, readFdxSource, type FdxSource } from '../fdx/source.js';
import type { Screenplay } from '../../../client/screenplay/index.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';

export async function importFdxScreenplay(
  input: ImportFdxScreenplayInput,
): Promise<ImportFdxScreenplayReport> {
  const source = await readFdxSource(input.sourcePath);
  const mapped = mapFdxScreenplay(parseFdxDocument(source.xml), source.sha256);
  const { projectFolder, session } = await openProjectSession(input);
  try {
    return commitFdxImport({ session, projectFolder, source, mapped });
  } finally {
    session.close();
  }
}

export async function applyFdxUpdate(
  input: FdxUpdateProjectInput & { reviewFingerprint: string },
): Promise<ImportFdxScreenplayReport> {
  if (typeof input.reviewFingerprint !== 'string' || !/^[0-9a-f]{64}$/u.test(input.reviewFingerprint)) {
    throw new ProjectDataError('SCREENPLAY_FDX_UPDATE_REVIEW_STALE', 'Review the export before updating the screenplay.');
  }
  const { session, projectFolder } = await openProjectSession(input);
  try {
    const accepted = requireImportSourceSha256(session, requireFdxImport(session));
    const candidate = await readStableFdxExport(session, projectFolder, accepted);
    const source = decodeFdxSource(candidate.exportPath, candidate.bytes);
    const mapped = mapFdxScreenplay(parseFdxDocument(source.xml), source.sha256);
    return commitFdxImport({ session, projectFolder, source, mapped, reviewFingerprint: input.reviewFingerprint });
  } finally {
    session.close();
  }
}

function commitFdxImport(input: {
  session: DatabaseSession;
  projectFolder: string;
  source: FdxSource;
  mapped: ReturnType<typeof mapFdxScreenplay>;
  reviewFingerprint?: string;
}): ImportFdxScreenplayReport {
  const writeSet = createProjectAssetFileWriteSet({ projectFolder: input.projectFolder });
  try {
    const report = input.session.db.transaction((tx) => {
      const session = { ...input.session, db: tx };
      if (input.reviewFingerprint !== undefined) {
        requireFdxImport(session);
        const latest = readFdxSourceBytes(resolveFdxExportPath(session, input.projectFolder));
        resolveFdxExportPath(session, input.projectFolder);
        if (!latest.equals(input.source.bytes)) {
          throw new ProjectDataError('SCREENPLAY_FDX_UPDATE_REVIEW_STALE', 'The export changed again. Review the latest export.');
        }
      }
      return importIntoSession({ ...input, session, writeSet });
    }, { behavior: 'immediate' });
    commitProjectAssetFileWriteSet(writeSet);
    return report;
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    if (isDestinationConflict(error)) {
      throw new ProjectDataError('SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
        `Retained FDX destination already exists for SHA-256 ${input.source.sha256}.`);
    }
    throw error;
  }
}

function importIntoSession(input: Parameters<typeof commitFdxImport>[0] & {
  writeSet: ReturnType<typeof createProjectAssetFileWriteSet>;
}): ImportFdxScreenplayReport {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no project row.');
  }
  if (readScreenplayImport(input.session)) {
    return refreshFdxScreenplay({ ...input, project });
  }
  if (!isEmptyScreenplay(readCanonicalScreenplay(input.session))) {
    throw new ProjectDataError('SCREENPLAY_NOT_EMPTY', 'FDX import requires an empty Screenplay.',
      { suggestion: 'Import into a Project whose Screenplay has no authored content.' });
  }
  return applyInitialFdxImport({ ...input, project });
}

function isEmptyScreenplay(screenplay: Screenplay): boolean {
  return screenplay.opening.length === 0
    && screenplay.scenes.length === 0
    && screenplay.sections.length === 0
    && screenplay.structure.length === 0
    && screenplay.references.length === 0;
}

function isDestinationConflict(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error as Error & { code?: string }).code === 'EEXIST';
}
