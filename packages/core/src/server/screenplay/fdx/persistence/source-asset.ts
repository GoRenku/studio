import type { ProjectRelativePath } from '../../../../client/index.js';
import { createAssetMembership, readAssetOwner } from '../../../assets/ownership.js';
import { readAssetFileRecordIncludingDiscarded } from '../../../database/access/asset-files.js';
import { insertAssetRecord, readAssetRecord } from '../../../database/access/assets.js';
import type { DatabaseSession } from '../../../database/lifecycle/store.js';
import { ProjectDataError } from '../../../project-data-error.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../../files/project-relative-paths.js';
import { resolveDurableDestinationFileSync } from '../../../project-asset-files/destinations/registry.js';
import { hashFileSync, projectPathExistsSync } from '../../../project-asset-files/file-operations.js';
import { persistProjectAssetFileAtDestinationSync } from '../../../project-asset-files/persistence.js';
import type { ProjectAssetFileWriteSet } from '../../../project-asset-files/types.js';
import type { FdxSource } from '../source.js';

export function persistFdxSourceAsset(input: {
  session: DatabaseSession;
  projectFolder: string;
  source: FdxSource;
  assetId: string;
  assetFileId: string;
  now: string;
  writeSet: ProjectAssetFileWriteSet;
}): void {
  const existingAsset = readAssetRecord(input.session, input.assetId);
  if (existingAsset) {
    const existingFile = readAssetFileRecordIncludingDiscarded(input.session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
    const owner = readAssetOwner(input.session, input.assetId);
    if (existingAsset.discardedAt
      || existingAsset.type !== 'screenplay_source'
      || existingAsset.mediaKind !== 'document'
      || existingAsset.origin !== 'imported'
      || owner?.kind !== 'project'
      || !existingFile
      || existingFile.discardedAt
      || existingFile.role !== 'source'
      || existingFile.mediaKind !== 'document'
      || existingFile.mimeType !== 'application/xml'
      || existingFile.contentHash !== input.source.sha256
      || !projectPathExistsSync(
        input.projectFolder,
        normalizeProjectRelativePath(existingFile.projectRelativePath),
      )
      || hashFileSync(resolveProjectRelativePath(
        input.projectFolder,
        normalizeProjectRelativePath(existingFile.projectRelativePath),
      )) !== input.source.sha256) {
      throw new ProjectDataError(
        'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
        `Retained FDX source identity conflicts with SHA-256 ${input.source.sha256}.`,
      );
    }
    return;
  }

  insertAssetRecord(input.session, {
    id: input.assetId,
    type: 'screenplay_source',
    mediaKind: 'document',
    title: input.source.filename,
    origin: 'imported',
    availability: 'ready',
    createdAt: input.now,
    updatedAt: input.now,
  });
  createAssetMembership(input.session, {
    assetId: input.assetId,
    owner: { kind: 'project' },
    now: input.now,
  });
  const sourceProjectRelativePath = input.source.filename as ProjectRelativePath;
  const destinationProjectRelativePath = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: { kind: 'screenplay.source' },
    namingMode: { kind: 'external' },
    sourceProjectRelativePath,
    mediaKind: 'document',
    now: input.now,
  });
  const file = persistProjectAssetFileAtDestinationSync({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    fileRole: 'source',
    mediaKind: 'document',
    sourcePath: input.source.absolutePath,
    sourceProjectRelativePath,
    destinationProjectRelativePath,
    mimeType: 'application/xml',
    now: input.now,
    writeSet: input.writeSet,
  });
  if (file.contentHash !== input.source.sha256) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_SOURCE_CHANGED',
      'FDX source changed after it was read and before it was retained.',
      { suggestion: 'Save the source file, then run the import again.' },
    );
  }
}
