import type { ProjectRelativePath } from '../../../../client/index.js';
import { readAssetFileOwner } from '../../../asset-files/ownership.js';
import { readAssetFileRecordIncludingDiscarded } from '../../../database/access/asset-files.js';
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

export function persistFdxSourceAssetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  source: FdxSource;
  assetFileId: string;
  now: string;
  writeSet: ProjectAssetFileWriteSet;
}): void {
  const existingAssetFile = readAssetFileRecordIncludingDiscarded(input.session, input.assetFileId);
  if (existingAssetFile) {
    assertRetainedFdxSourceAssetFile(input);
    return;
  }
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
    owner: { kind: 'project' },
    assetFileMetadata: {
      type: 'screenplay_source',
      title: input.source.filename,
      origin: 'imported'
    },
    session: input.session,
    projectFolder: input.projectFolder,
    assetFileId: input.assetFileId,
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

export function assertRetainedFdxSourceAssetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  source: FdxSource;
  assetFileId: string;
}): void {
  const existingAssetFile = readAssetFileRecordIncludingDiscarded(input.session, input.assetFileId);
  const owner = readAssetFileOwner(input.session, input.assetFileId);
  if (!existingAssetFile
    || existingAssetFile.discardedAt
    || existingAssetFile.type !== 'screenplay_source'
    || existingAssetFile.mediaKind !== 'document'
    || existingAssetFile.origin !== 'imported'
    || owner?.kind !== 'project'
    || existingAssetFile.mimeType !== 'application/xml'
    || existingAssetFile.contentHash !== input.source.sha256
    || !projectPathExistsSync(
      input.projectFolder,
      normalizeProjectRelativePath(existingAssetFile.projectRelativePath),
    )
    || hashFileSync(resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(existingAssetFile.projectRelativePath),
    )) !== input.source.sha256) {
    throw new ProjectDataError(
      'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
      `Retained FDX source identity conflicts with SHA-256 ${input.source.sha256}.`,
    );
  }
}
