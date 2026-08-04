import { createRandomIdGenerator, createUniqueIdAllocator } from '../../entity-ids.js';
import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../../project-asset-files/index.js';
import {
  studioScreenplayResourceKey,
  studioScreenplayStructureResourceKey,
} from '../../studio-coordination/resource-keys.js';
import { insertScreenplayRevision } from '../persistence/revisions.js';
import { readScreenplayAggregate, replaceScreenplayAggregate } from '../persistence/screenplay.js';
import { readScreenplaySubjectIds } from '../persistence/references.js';
import { assertValidScreenplay } from '../validation/blocks.js';
import {
  FDX_IMPORTER_VERSION,
  type ImportFdxScreenplayInput,
  type ImportFdxScreenplayReport,
  type ScreenplayImport,
} from '../fdx/contracts.js';
import { FdxIdentityFactory } from '../fdx/identifiers.js';
import { mapFdxScreenplay } from '../fdx/mapping/screenplay.js';
import { parseFdxDocument } from '../fdx/parser/document.js';
import {
  insertScreenplayImport,
  readScreenplayImport,
} from '../fdx/persistence/import-record.js';
import { persistFdxSourceAsset } from '../fdx/persistence/source-asset.js';
import { readFdxSource } from '../fdx/source.js';
import { assertValidFdxImportReport } from '../fdx/validation.js';

export async function importFdxScreenplay(
  input: ImportFdxScreenplayInput,
): Promise<ImportFdxScreenplayReport> {
  const source = await readFdxSource(input.sourcePath);
  const mapped = mapFdxScreenplay(parseFdxDocument(source.xml), source.sha256);
  const identities = new FdxIdentityFactory(source.sha256);
  const importId = identities.id('screenplay_import', 'import');
  const sourceAssetId = identities.id('asset', 'sourceAsset');
  const sourceAssetFileId = identities.id('asset_file', 'sourceAsset/file');
  const { projectFolder, session } = await openProjectSession(input);
  const writeSet = createProjectAssetFileWriteSet({ projectFolder });

  try {
    if (readScreenplayImport(session)) {
      throw new ProjectDataError(
        'SCREENPLAY_FDX_IMPORT_EXISTS',
        'This Project already has a retained FDX Screenplay Import.',
      );
    }
    if (!isEmptyScreenplay(readScreenplayAggregate(session))) {
      throw new ProjectDataError(
        'SCREENPLAY_NOT_EMPTY',
        'FDX import requires an empty Screenplay.',
        { suggestion: 'Import into a Project whose Screenplay has no authored content.' },
      );
    }
    assertValidScreenplay(mapped.screenplay, {
      subjects: readScreenplaySubjectIds(session),
      context: 'mapped FDX Screenplay',
    });
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`,
      );
    }

    const importedAt = new Date().toISOString();
    const screenplayImport: ScreenplayImport = {
      id: importId,
      sourceAssetId,
      sourceAssetFileId,
      importerVersion: FDX_IMPORTER_VERSION,
      importedAt,
      technicalLog: mapped.technicalLog,
    };
    const revisionId = createUniqueIdAllocator(createRandomIdGenerator())('screenplay_revision');
    const report: ImportFdxScreenplayReport = {
      valid: true,
      warnings: [],
      project: { id: project.id, projectName: project.projectName },
      screenplayImport: {
        id: screenplayImport.id,
        sourceAssetId,
        sourceAssetFileId,
        importerVersion: FDX_IMPORTER_VERSION,
        importedAt,
        sourceFilename: source.filename,
        sha256: source.sha256,
      },
      counts: mapped.counts,
      candidates: mapped.candidates,
      resourceKeys: [
        studioScreenplayResourceKey(),
        studioScreenplayStructureResourceKey(),
      ],
    };
    assertValidFdxImportReport(report);

    try {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        persistFdxSourceAsset({
          session: txSession,
          projectFolder,
          source,
          assetId: sourceAssetId,
          assetFileId: sourceAssetFileId,
          now: importedAt,
          writeSet,
        });
        insertScreenplayImport(txSession, screenplayImport);
        replaceScreenplayAggregate(txSession, mapped.screenplay);
        insertScreenplayRevision({
          session: txSession,
          id: revisionId,
          screenplay: mapped.screenplay,
          sourceCommand: 'screenplay.import-fdx',
          createdAt: importedAt,
        });
      });
    } catch (error) {
      if (isDestinationConflict(error)) {
        throw new ProjectDataError(
          'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
          `Retained FDX destination already exists for SHA-256 ${source.sha256}.`,
        );
      }
      throw error;
    }
    commitProjectAssetFileWriteSet(writeSet);
    return report;
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    throw error;
  } finally {
    session.close();
  }
}

function isEmptyScreenplay(screenplay: ReturnType<typeof readScreenplayAggregate>): boolean {
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
