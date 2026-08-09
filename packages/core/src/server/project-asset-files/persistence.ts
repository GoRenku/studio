import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import {
  insertAssetFileRecord,
  readAssetFileRecord,
  type AssetFileRecord,
} from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  hashFile,
  hashFileSync,
  mimeTypeForProjectPath,
  statProjectFile,
  statProjectFileSync,
} from './file-operations.js';
import { resolveDurableDestinationFile, resolveDurableDestinationFileSync } from './destinations/registry.js';
import { assertDurableProjectAssetFilePath, assertResolvedPathInsideProject } from './path-guards.js';
import { validateProjectReferenceFileInput } from './reference-validation.js';
import type {
  PersistProjectAssetFileInput,
  ProjectAssetFileWriteSet,
  ProjectMediaKind,

} from './types.js';

export async function persistProjectAssetFile(
  input: PersistProjectAssetFileInput & { writeSet?: ProjectAssetFileWriteSet }
): Promise<AssetFileRecord> {
  const source = await validateProjectReferenceFileInput({
    projectFolder: input.projectFolder,
    projectRelativePath: input.sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    role: input.fileRole,
  });
  for (let attempt = 0; attempt < collisionAttemptLimit(input); attempt += 1) {
    const destination = await resolveDurableDestinationFile({
      session: input.session,
      projectFolder: input.projectFolder,
      destination: input.destination,
      namingMode: input.namingMode,
      sourceProjectRelativePath: source.projectRelativePath,
      mediaKind: input.mediaKind,
      now: input.now,
    });
    try {
      return await persistProjectAssetFileAtDestination({
        ...input,
        sourcePath: source.absolutePath,
        sourceProjectRelativePath: source.projectRelativePath,
        destinationProjectRelativePath: destination,
      });
    } catch (error) {
      if (!isDestinationConflict(error)) {
        throw error;
      }
    }
  }
  throw destinationCollisionFailure(input.namingMode.kind);
}

export function persistProjectAssetFileSync(
  input: PersistProjectAssetFileInput & { writeSet?: ProjectAssetFileWriteSet }
): AssetFileRecord {
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    input.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  statProjectFileSync(sourcePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Project reference file was not found: ${sourceProjectRelativePath}.`,
  });
  for (let attempt = 0; attempt < collisionAttemptLimit(input); attempt += 1) {
    const destination = resolveDurableDestinationFileSync({
      session: input.session,
      projectFolder: input.projectFolder,
      destination: input.destination,
      namingMode: input.namingMode,
      sourceProjectRelativePath,
      mediaKind: input.mediaKind,
      now: input.now,
    });
    try {
      return persistProjectAssetFileAtDestinationSync({
        session: input.session,
        projectFolder: input.projectFolder,
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        fileRole: input.fileRole,
        mediaKind: input.mediaKind,
        sourcePath,
        sourceProjectRelativePath,
        destinationProjectRelativePath: destination,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        durationSeconds: input.durationSeconds,
        now: input.now,
        writeSet: input.writeSet,
      });
    } catch (error) {
      if (!isDestinationConflict(error)) {
        throw error;
      }
    }
  }
  throw destinationCollisionFailure(input.namingMode.kind);
}

async function persistProjectAssetFileAtDestination(
  input: PersistProjectAssetFileInput & {
    writeSet?: ProjectAssetFileWriteSet;
    sourcePath: string;
    sourceProjectRelativePath: ProjectRelativePath;
    destinationProjectRelativePath: ProjectRelativePath;
  }
): Promise<AssetFileRecord> {
  assertDurableProjectAssetFilePath(input.destinationProjectRelativePath);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    input.destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (input.sourcePath !== destinationPath) {
      try {
        await fs.copyFile(input.sourcePath, destinationPath, fsSync.constants.COPYFILE_EXCL);
      } catch (error) {
        if (isFileExistsError(error)) {
          throw destinationConflict(input.destinationProjectRelativePath);
        }
        throw error;
      }
      copied = true;
      input.writeSet?.recordCreatedFile(input.destinationProjectRelativePath);
    }
    const stats = await statProjectFile(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Persisted project asset file was not found: ${input.destinationProjectRelativePath}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.assetFileId,
      assetId: input.assetId,
      role: input.fileRole,
      projectRelativePath: input.destinationProjectRelativePath,
      mimeType: input.mimeType ?? mimeTypeForProjectPath(input.destinationProjectRelativePath, input.mediaKind),
      mediaKind: input.mediaKind,
      sizeBytes: stats.size,
      contentHash: await hashFile(destinationPath),
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      createdAt: input.now,
      updatedAt: input.now,
    });
    return requireInsertedAssetFile(input.session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
  } catch (error) {
    if (copied) {
      await removeCopiedProjectAssetFile(
        input.projectFolder,
        input.destinationProjectRelativePath
      );
    }
    throw error;
  }
}

export async function removeCopiedProjectAssetFile(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<void> {
  assertDurableProjectAssetFilePath(projectRelativePath);
  const resolved = resolveProjectRelativePath(projectFolder, projectRelativePath);
  assertResolvedPathInsideProject(projectFolder, resolved);
  await fs.rm(resolved, { force: true });
}

export function removeCopiedProjectAssetFileSync(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): void {
  assertDurableProjectAssetFilePath(projectRelativePath);
  const resolved = resolveProjectRelativePath(projectFolder, projectRelativePath);
  assertResolvedPathInsideProject(projectFolder, resolved);
  fsSync.rmSync(resolved, { force: true });
}

export function persistProjectAssetFileAtDestinationSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  assetFileId: string;
  fileRole: string;
  mediaKind: ProjectMediaKind;
  sourceProjectRelativePath: ProjectRelativePath;
  sourcePath: string;
  destinationProjectRelativePath: ProjectRelativePath;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  now: string;
  writeSet?: ProjectAssetFileWriteSet;
}): AssetFileRecord {
  assertDurableProjectAssetFilePath(input.destinationProjectRelativePath);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    input.destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    fsSync.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (input.sourcePath !== destinationPath) {
      try {
        fsSync.copyFileSync(input.sourcePath, destinationPath, fsSync.constants.COPYFILE_EXCL);
      } catch (error) {
        if (isFileExistsError(error)) {
          throw destinationConflict(input.destinationProjectRelativePath);
        }
        throw error;
      }
      copied = true;
      input.writeSet?.recordCreatedFile(input.destinationProjectRelativePath);
    }
    const stats = statProjectFileSync(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Persisted project asset file was not found: ${input.destinationProjectRelativePath}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.assetFileId,
      assetId: input.assetId,
      role: input.fileRole,
      projectRelativePath: input.destinationProjectRelativePath,
      mimeType: input.mimeType ?? mimeTypeForProjectPath(input.destinationProjectRelativePath, input.mediaKind),
      mediaKind: input.mediaKind,
      sizeBytes: stats.size,
      contentHash: hashFileSync(destinationPath),
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      createdAt: input.now,
      updatedAt: input.now,
    });
    return requireInsertedAssetFile(input.session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
  } catch (error) {
    if (copied && !input.writeSet) {
      removeCopiedProjectAssetFileSync(
        input.projectFolder,
        input.destinationProjectRelativePath
      );
    }
    throw error;
  }
}

function collisionAttemptLimit(input: PersistProjectAssetFileInput): number {
  return input.namingMode.kind === 'generated' ? 16 : 1000;
}

function isDestinationConflict(error: unknown): boolean {
  return error instanceof ProjectDataError &&
    error.code === 'PROJECT_ASSET_FILE_DESTINATION_CONFLICT';
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === 'EEXIST';
}

function destinationConflict(path: ProjectRelativePath): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_ASSET_FILE_DESTINATION_CONFLICT',
    `Project asset file destination already exists: ${path}.`
  );
}

function destinationCollisionFailure(
  namingMode: PersistProjectAssetFileInput['namingMode']['kind']
): ProjectDataError {
  return new ProjectDataError(
    namingMode === 'generated'
      ? 'PROJECT_ASSET_FILE_GENERATION_TOKEN_ALLOCATION_FAILED'
      : 'PROJECT_ASSET_FILE_EXTERNAL_NAME_ALLOCATION_FAILED',
    `Could not allocate an exclusive ${namingMode} project asset file destination.`
  );
}

function requireInsertedAssetFile(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): AssetFileRecord {
  const row = readAssetFileRecord(session, input);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_INSERT_FAILED',
      `Project asset file record was not inserted: ${input.assetFileId}.`
    );
  }
  return row;
}
