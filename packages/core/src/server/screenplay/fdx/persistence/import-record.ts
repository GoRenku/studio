import { eq } from 'drizzle-orm';
import { readAssetFileRecordIncludingDiscarded } from '../../../database/access/asset-files.js';
import type { DatabaseSession } from '../../../database/lifecycle/store.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { screenplayImports } from '../../../schema/index.js';
import { readAssetFileOwner } from '../../../asset-files/ownership.js';
import {
  FDX_IMPORTER_VERSION,
  type ScreenplayImport,
  type ScreenplayImportLogEntry,
} from '../contracts.js';

const SCREENPLAY_IMPORT_SINGLETON_KEY = 1;

export function readScreenplayImport(
  session: DatabaseSession,
): ScreenplayImport | null {
  const row = session.db
    .select()
    .from(screenplayImports)
    .where(eq(screenplayImports.singletonKey, SCREENPLAY_IMPORT_SINGLETON_KEY))
    .get();
  if (!row) {
    return null;
  }
  let technicalLog: unknown;
  try {
    technicalLog = JSON.parse(row.technicalLogJson);
  } catch {
    throw invalidImportRecord('technical log is not valid JSON');
  }
  if (row.importerVersion !== FDX_IMPORTER_VERSION || !isTechnicalLog(technicalLog)) {
    throw invalidImportRecord('stored importer version or technical log is invalid');
  }
  assertValidSourceAssetFile(session, {
    assetFileId: row.sourceAssetFileId,
  });
  return {
    id: row.id,
    sourceAssetFileId: row.sourceAssetFileId,
    importerVersion: FDX_IMPORTER_VERSION,
    importedAt: row.importedAt,
    technicalLog,
  };
}

export function assertScreenplayIsRenkuEditable(
  session: DatabaseSession,
): void {
  const row = session.db
    .select({ id: screenplayImports.id })
    .from(screenplayImports)
    .where(eq(screenplayImports.singletonKey, SCREENPLAY_IMPORT_SINGLETON_KEY))
    .get();
  if (row) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_BACKED_READ_ONLY',
      'This Screenplay is backed by an FDX import and cannot be edited in Renku.',
      {
        suggestion:
          'Renku screenplay authoring is available only for Screenplays without an FDX import.',
      },
    );
  }
}

function assertValidSourceAssetFile(
  session: DatabaseSession,
  input: { assetFileId: string },
): void {
  const assetFile = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
  const owner = readAssetFileOwner(session, input.assetFileId);
  if (!assetFile
    || assetFile.discardedAt
    || assetFile.type !== 'screenplay_source'
    || assetFile.mediaKind !== 'document'
    || assetFile.origin !== 'imported'
    || owner?.kind !== 'project'
    || assetFile.mimeType !== 'application/xml'
    || !assetFile.contentHash?.match(/^[0-9a-f]{64}$/u)) {
    throw invalidImportRecord('retained source AssetFile contract is invalid');
  }
}

export function insertScreenplayImport(
  session: DatabaseSession,
  value: ScreenplayImport,
): void {
  if (value.importerVersion !== FDX_IMPORTER_VERSION || !isTechnicalLog(value.technicalLog)) {
    throw invalidImportRecord('import write does not match the current contract');
  }
  session.db.insert(screenplayImports).values({
    id: value.id,
    singletonKey: SCREENPLAY_IMPORT_SINGLETON_KEY,
    sourceAssetFileId: value.sourceAssetFileId,
    importerVersion: value.importerVersion,
    importedAt: value.importedAt,
    technicalLogJson: JSON.stringify(value.technicalLog),
  }).run();
}

export function updateScreenplayImport(
  session: DatabaseSession,
  value: ScreenplayImport,
): void {
  if (value.importerVersion !== FDX_IMPORTER_VERSION || !isTechnicalLog(value.technicalLog)) {
    throw invalidImportRecord('refresh write does not match the current contract');
  }
  const result = session.db.update(screenplayImports).set({
    sourceAssetFileId: value.sourceAssetFileId,
    importerVersion: value.importerVersion,
    importedAt: value.importedAt,
    technicalLogJson: JSON.stringify(value.technicalLog),
  }).where(eq(screenplayImports.singletonKey, SCREENPLAY_IMPORT_SINGLETON_KEY)).run();
  if (result.changes !== 1) {
    throw invalidImportRecord('refresh could not update the singleton record');
  }
}

export function assertAssetFileIsNotScreenplayImportSource(
  session: DatabaseSession,
  assetFileId: string,
): void {
  const assetFile = readAssetFileRecordIncludingDiscarded(session, assetFileId);
  const block = screenplaySourceDeleteBlock(assetFile?.type);
  if (block) {
    throw new ProjectDataError(block.code, block.message);
  }
}

export function screenplaySourceDeleteBlock(type: string | undefined) {
  return type === 'screenplay_source' ? {
    code: 'SCREENPLAY_FDX_SOURCE_PROTECTED',
    message: 'Retained screenplay source files cannot be deleted.',
  } : null;
}

function isTechnicalLog(value: unknown): value is ScreenplayImportLogEntry[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const candidate = entry as Record<string, unknown>;
    if (Object.keys(candidate).length !== 4
      || !Number.isInteger(candidate.sourceParagraphIndex)) {
      return false;
    }
    if (candidate.type === 'paragraphNormalization') {
      return candidate.sourceParagraphType === 'General'
        && (candidate.targetBlockType === 'action' || candidate.targetBlockType === 'transition');
    }
    return candidate.type === 'orphanDialogueNormalization'
      && candidate.sourceParagraphType === 'Dialogue'
      && candidate.targetBlockType === 'action';
  });
}

function invalidImportRecord(reason: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_FDX_IMPORT_INVALID',
    `Screenplay Import ${reason}.`,
  );
}

export function requireImportSourceSha256(session: DatabaseSession, screenplayImport: ScreenplayImport): string {
  const file = readAssetFileRecordIncludingDiscarded(session, screenplayImport.sourceAssetFileId);
  if (!file?.contentHash?.match(/^[0-9a-f]{64}$/u)) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_IMPORT_INVALID',
      'Screenplay Import retained source hash is unavailable.',
    );
  }
  return file.contentHash;
}
