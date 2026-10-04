import type { AssetFile, ProjectRelativePath } from '../../../client/index.js';
import { listAssetFilesInSession, readOwnedAssetFile } from '../../asset-files/projection.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { hashFileSync, projectPathExistsSync } from '../../project-asset-files/file-operations.js';
import { resolveDurableDestinationFileSync } from '../../project-asset-files/destinations/registry.js';
import { persistProjectAssetFileAtDestinationSync } from '../../project-asset-files/persistence.js';
import type { ProjectAssetFileWriteSet } from '../../project-asset-files/types.js';
import type { ScreenplaySupportingMaterialSource } from './source.js';

const MATERIAL_TYPE = 'screenplay_supporting_material';

export function findExistingScreenplaySupportingMaterial(input: {
  session: DatabaseSession;
  projectFolder: string;
  sha256: string;
}): AssetFile | null {
  const matching = listAssetFilesInSession(input.session, {
    owner: { kind: 'project' },
    type: MATERIAL_TYPE,
  }).find((assetFile) => assetFile.contentHash === input.sha256);
  if (!matching) {
    return null;
  }
  const sourceFile = matching;
  if (
    matching.mediaKind !== 'file'
    || matching.origin !== 'imported'
    || sourceFile.mediaKind !== 'file'
    || sourceFile.mimeType !== 'application/octet-stream'
    || sourceFile.contentHash !== input.sha256
  ) {
    throw destinationConflict(`Stored supporting material conflicts with SHA-256 ${input.sha256}.`);
  }
  const projectRelativePath = normalizeProjectRelativePath(sourceFile.projectRelativePath);
  if (!retainedFileMatches(input.projectFolder, projectRelativePath, input.sha256)) {
    throw destinationConflict(`Stored supporting material bytes conflict with SHA-256 ${input.sha256}.`);
  }
  return matching;
}

function retainedFileMatches(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath,
  sha256: string,
): boolean {
  try {
    return projectPathExistsSync(projectFolder, projectRelativePath)
      && hashFileSync(resolveProjectRelativePath(projectFolder, projectRelativePath)) === sha256;
  } catch {
    return false;
  }
}

export function persistScreenplaySupportingMaterial(input: {
  session: DatabaseSession;
  projectFolder: string;
  source: ScreenplaySupportingMaterialSource;
  assetFileId: string;
  now: string;
  writeSet: ProjectAssetFileWriteSet;
}): AssetFile {
  const sourceProjectRelativePath = input.source.filename as ProjectRelativePath;
  const destinationProjectRelativePath = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: { kind: 'screenplay.supportingMaterial' },
    namingMode: { kind: 'external' },
    sourceProjectRelativePath,
    mediaKind: 'file',
    now: input.now,
  });
  const file = persistProjectAssetFileAtDestinationSync({
    owner: { kind: 'project' },
    assetFileMetadata: {
      type: MATERIAL_TYPE,
      title: input.source.filename,
      origin: 'imported'
    },
    session: input.session,
    projectFolder: input.projectFolder,
    assetFileId: input.assetFileId,
    mediaKind: 'file',
    sourcePath: input.source.absolutePath,
    sourceProjectRelativePath,
    destinationProjectRelativePath,
    mimeType: 'application/octet-stream',
    now: input.now,
    writeSet: input.writeSet,
  });
  if (file.contentHash !== input.source.sha256) {
    throw new ProjectDataError(
      'SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE',
      'Supporting material changed after it was read and before it was retained.',
      { suggestion: 'Wait for the source file to finish changing, then import it again.' },
    );
  }
  const material = readOwnedAssetFile(input.session, {
    owner: { kind: 'project' },
    assetFileId: input.assetFileId,
  });
  if (!material) {
    throw destinationConflict(`Imported supporting material was not found: ${input.assetFileId}.`);
  }
  return material;
}

export function isProjectAssetFileDestinationConflict(error: unknown): boolean {
  return error instanceof ProjectDataError
    && (
      error.code === 'PROJECT_ASSET_FILE_DESTINATION_CONFLICT'
      || error.code === 'PROJECT_ASSET_FILE_EXTERNAL_NAME_ALLOCATION_FAILED'
    );
}

export function isProjectAssetFileSourceReadFailure(error: unknown): boolean {
  return error instanceof ProjectDataError
    && (
      error.code === 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND'
      || error.code === 'PROJECT_ASSET_FILE_SOURCE_READ_FAILED'
    );
}

export function isProjectAssetFileDestinationWriteFailure(error: unknown): boolean {
  return error instanceof ProjectDataError
    && (
      error.code === 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND'
      || error.code === 'PROJECT_ASSET_FILE_DESTINATION_WRITE_FAILED'
    );
}

export function destinationConflict(message: string): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_SUPPORTING_MATERIAL_DESTINATION_CONFLICT',
    message,
    { suggestion: 'Inspect the registered supporting-material Asset and retained project file.' },
  );
}

export function destinationWriteFailure(): ProjectDataError {
  return new ProjectDataError(
    'SCREENPLAY_SUPPORTING_MATERIAL_DESTINATION_WRITE_FAILED',
    'Could not retain supporting material under screenplay/.',
    {
      suggestion:
        'Check that the Project folder is writable and has sufficient free space, then retry.',
    },
  );
}
