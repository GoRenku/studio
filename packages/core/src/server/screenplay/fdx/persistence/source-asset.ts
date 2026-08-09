import type { ProjectRelativePath } from '../../../../client/index.js';
import { createAssetMembership } from '../../../assets/ownership.js';
import { insertAssetRecord } from '../../../database/access/assets.js';
import type { DatabaseSession } from '../../../database/lifecycle/store.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { resolveDurableDestinationFileSync } from '../../../project-asset-files/destinations/registry.js';
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
