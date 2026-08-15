import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
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
import { readFdxSource } from '../fdx/source.js';
import type { Screenplay } from '../../../client/screenplay/index.js';
import { readCanonicalScreenplay } from '../projections/screenplay.js';

export async function importFdxScreenplay(
  input: ImportFdxScreenplayInput,
): Promise<ImportFdxScreenplayReport> {
  const source = await readFdxSource(input.sourcePath);
  const mapped = mapFdxScreenplay(parseFdxDocument(source.xml), source.sha256);
  const { projectFolder, session } = await openProjectSession(input);
  const writeSet = createProjectAssetFileWriteSet({ projectFolder });

  try {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`,
      );
    }
    const currentImport = readScreenplayImport(session);
    const current = readCanonicalScreenplay(session);
    if (!currentImport) {
      if (!isEmptyScreenplay(current)) {
        throw new ProjectDataError(
          'SCREENPLAY_NOT_EMPTY',
          'FDX import requires an empty Screenplay.',
          { suggestion: 'Import into a Project whose Screenplay has no authored content.' },
        );
      }
      return applyInitialFdxImport({
        session,
        projectFolder,
        writeSet,
        project,
        source,
        mapped,
      });
    }
    return refreshFdxScreenplay({
      session,
      projectFolder,
      writeSet,
      project,
      source,
      mapped,
      currentImport,
      current,
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    if (isDestinationConflict(error)) {
      throw new ProjectDataError(
        'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
        `Retained FDX destination already exists for SHA-256 ${source.sha256}.`,
      );
    }
    throw error;
  } finally {
    session.close();
  }
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
