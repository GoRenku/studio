import type { DatabaseSession } from '../database/lifecycle/store.js';
import { insertAssetFileRecord, readAssetFileRecordByPath } from '../database/access/asset-files.js';
import { assetFileOwnerKey } from '../asset-files/owner-keys.js';
import { toAssetFile } from '../asset-files/projection.js';
import { persistProjectAssetFileSync } from '../project-asset-files/persistence.js';
import type { ProjectAssetFileWriteSet, ProjectAssetFileDestination } from '../project-asset-files/types.js';
import { ProjectDataError } from '../project-data-error.js';
import { readReferenceSource, type referenceDestination } from './sources.js';

export function persistReferenceFile(input: {
  session: DatabaseSession; projectFolder: string; writeSet: ProjectAssetFileWriteSet;
  source: ReturnType<typeof readReferenceSource>; owner: ReturnType<typeof referenceDestination>;
  destination: ProjectAssetFileDestination; assetFileId: string; now: string;
}) {
  const { source, owner } = input;
  if (!source.inPlace) {
    const record = persistProjectAssetFileSync({
      session: input.session, projectFolder: input.projectFolder, writeSet: input.writeSet,
      owner: owner.owner, assetFileMetadata: { type: owner.type, title: source.title, origin: 'imported' },
      assetFileId: input.assetFileId, sourceProjectRelativePath: source.projectRelativePath,
      destination: input.destination, namingMode: { kind: 'external' }, mediaKind: source.mediaKind,
      mimeType: source.mimeType, now: input.now,
    });
    if (record.contentHash !== source.contentHash) { throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_CHANGED', 'Reference bytes changed during import.'); }
    return toAssetFile(record);
  }
  const current = readReferenceSource(input.projectFolder, { sourceProjectRelativePath: source.projectRelativePath }, owner);
  if (current.contentHash !== source.contentHash || current.sizeBytes !== source.sizeBytes) {
    throw new ProjectDataError('CORE_REFERENCE_FILE_SOURCE_CHANGED', 'Reference bytes changed during import.');
  }
  const existing = readAssetFileRecordByPath(input.session, source.projectRelativePath);
  const ownerKey = assetFileOwnerKey(owner.owner);
  if (existing) {
    if (existing.discardedAt || existing.ownerKey !== ownerKey || existing.type !== owner.type
      || existing.contentHash !== source.contentHash || existing.sizeBytes !== source.sizeBytes) {
      throw new ProjectDataError('CORE_REFERENCE_FILE_CONFLICT', 'An existing retained file conflicts with this import.');
    }
    return toAssetFile(existing);
  }
  const record = { id: input.assetFileId, ownerKey, type: owner.type, title: source.title, origin: 'imported',
    availability: 'ready', projectRelativePath: source.projectRelativePath, mediaKind: source.mediaKind,
    sizeBytes: source.sizeBytes, contentHash: source.contentHash, mimeType: source.mimeType,
    createdAt: input.now, updatedAt: input.now };
  insertAssetFileRecord(input.session, record);
  return toAssetFile({ ...record, localeId: null, oneLineSummary: null, referenceName: null, tags: [],
    generationProvenance: null, authoredFromShotPlanId: null, previsRevisionId: null,
    width: null, height: null, durationSeconds: null, discardedAt: null, discardOperationId: null, restoredAt: null });
}
