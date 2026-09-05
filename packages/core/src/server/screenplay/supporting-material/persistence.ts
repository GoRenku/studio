import type { Asset, ProjectRelativePath } from '../../../client/index.js';
import { createAssetMembership } from '../../assets/ownership.js';
import { listAssetsInSession, readOwnedAsset } from '../../assets/projection.js';
import { insertAssetRecord } from '../../database/access/assets.js';
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
}): Asset | null {
  const matching = listAssetsInSession(input.session, {
    owner: { kind: 'project' },
    type: MATERIAL_TYPE,
  }).find((asset) => asset.files.some((file) => file.contentHash === input.sha256));
  if (!matching) {
    return null;
  }
  const sourceFile = matching.files[0];
  if (
    matching.mediaKind !== 'file'
    || matching.origin !== 'imported'
    || matching.files.length !== 1
    || !sourceFile
    || sourceFile.role !== 'source'
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
  assetId: string;
  assetFileId: string;
  now: string;
  writeSet: ProjectAssetFileWriteSet;
}): Asset {
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

  insertAssetRecord(input.session, {
    id: input.assetId,
    type: MATERIAL_TYPE,
    mediaKind: 'file',
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
  const file = persistProjectAssetFileAtDestinationSync({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    fileRole: 'source',
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
  const material = readOwnedAsset(input.session, {
    owner: { kind: 'project' },
    assetId: input.assetId,
  });
  if (!material) {
    throw destinationConflict(`Imported supporting material was not found: ${input.assetId}.`);
  }
  return material;
}

export function isProjectAssetDestinationConflict(error: unknown): boolean {
  return error instanceof ProjectDataError
    && (
      error.code === 'PROJECT_ASSET_FILE_DESTINATION_CONFLICT'
      || error.code === 'PROJECT_ASSET_FILE_EXTERNAL_NAME_ALLOCATION_FAILED'
    );
}

export function isProjectAssetSourceReadFailure(error: unknown): boolean {
  return error instanceof ProjectDataError
    && (
      error.code === 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND'
      || error.code === 'PROJECT_ASSET_FILE_SOURCE_READ_FAILED'
    );
}

export function isProjectAssetDestinationWriteFailure(error: unknown): boolean {
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
