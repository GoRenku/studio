import { eq } from 'drizzle-orm';
import { readAssetFileRecordIncludingDiscarded } from '../../../database/access/asset-files.js';
import { readAssetRecord } from '../../../database/access/assets.js';
import type { DatabaseSession } from '../../../database/lifecycle/store.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { screenplayImports } from '../../../schema/index.js';
import { readAssetOwner } from '../../../assets/ownership.js';
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
  assertValidSourceAsset(session, {
    assetId: row.sourceAssetId,
    assetFileId: row.sourceAssetFileId,
  });
  return {
    id: row.id,
    sourceAssetId: row.sourceAssetId,
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

function assertValidSourceAsset(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string },
): void {
  const asset = readAssetRecord(session, input.assetId);
  const file = readAssetFileRecordIncludingDiscarded(session, input);
  const owner = readAssetOwner(session, input.assetId);
  if (!asset
    || asset.discardedAt
    || asset.type !== 'screenplay_source'
    || asset.mediaKind !== 'document'
    || asset.origin !== 'imported'
    || owner?.kind !== 'project'
    || !file
    || file.discardedAt
    || file.assetId !== input.assetId
    || file.role !== 'source'
    || file.mediaKind !== 'document'
    || file.mimeType !== 'application/xml'
    || !file.contentHash?.match(/^[0-9a-f]{64}$/u)) {
    throw invalidImportRecord('retained source Asset/File contract is invalid');
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
    sourceAssetId: value.sourceAssetId,
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
    sourceAssetId: value.sourceAssetId,
    sourceAssetFileId: value.sourceAssetFileId,
    importerVersion: value.importerVersion,
    importedAt: value.importedAt,
    technicalLogJson: JSON.stringify(value.technicalLog),
  }).where(eq(screenplayImports.singletonKey, SCREENPLAY_IMPORT_SINGLETON_KEY)).run();
  if (result.changes !== 1) {
    throw invalidImportRecord('refresh could not update the singleton record');
  }
}

export function assertAssetIsNotScreenplayImportSource(
  session: DatabaseSession,
  assetId: string,
): void {
  const row = session.db
    .select({ id: screenplayImports.id })
    .from(screenplayImports)
    .where(eq(screenplayImports.sourceAssetId, assetId))
    .get();
  if (row) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_SOURCE_IN_USE',
      `Asset ${assetId} is the retained source of Screenplay Import ${row.id}.`,
      { suggestion: 'Keep the retained FDX source while its Screenplay Import exists.' },
    );
  }
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
