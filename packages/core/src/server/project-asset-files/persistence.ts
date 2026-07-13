import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import {
  insertAssetFileRecord,
  readAssetFileRecord,
  readAssetFileRecordIncludingDiscarded,
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
  ShotVideoTakeMediaRole,
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
  const destination = await resolveDurableDestinationFile({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: input.destination,
    sourceProjectRelativePath: source.projectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
  assertDurableProjectAssetFilePath(destination);
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destination
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  let copied = false;
  try {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    if (source.absolutePath !== destinationPath) {
      await fs.copyFile(source.absolutePath, destinationPath);
      copied = true;
      input.writeSet?.recordCreatedFile(destination);
    }
    const stats = await statProjectFile(destinationPath, {
      code: 'PROJECT_ASSET_FILE_DESTINATION_NOT_FOUND',
      message: `Persisted project asset file was not found: ${destination}.`,
    });
    insertAssetFileRecord(input.session, {
      id: input.assetFileId,
      assetId: input.assetId,
      role: input.fileRole,
      projectRelativePath: destination,
      mimeType: input.mimeType ?? mimeTypeForProjectPath(destination, input.mediaKind),
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
      await removeCopiedProjectAssetFile(input.projectFolder, destination);
    }
    throw error;
  }
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
  const destination = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: input.destination,
    sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
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
}

export async function copyTakeOwnedProjectAssetFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetAssetId: string;
  targetAssetFileId: string;
  targetTakeId: string;
  role: ShotVideoTakeMediaRole;
  fileRole: string;
  mediaKind: ProjectMediaKind;
  mimeType?: string;
  now: string;
}): Promise<AssetFileRecord> {
  const sourceFile = readAssetFileRecord(input.session, {
    assetId: input.sourceAssetId,
    assetFileId: input.sourceAssetFileId,
  });
  if (!sourceFile) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SOURCE_RECORD_MISSING',
      `Take-owned source asset file was not found: ${input.sourceAssetFileId}.`
    );
  }
  return persistProjectAssetFile({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.targetAssetId,
    assetFileId: input.targetAssetFileId,
    sourceProjectRelativePath: sourceFile.projectRelativePath,
    destination: {
      kind: 'shotVideoTake.media',
      takeId: input.targetTakeId,
      role: input.role,
    },
    fileRole: input.fileRole,
    mediaKind: input.mediaKind,
    mimeType: input.mimeType ?? sourceFile.mimeType ?? undefined,
    width: sourceFile.width ?? undefined,
    height: sourceFile.height ?? undefined,
    durationSeconds: sourceFile.durationSeconds ?? undefined,
    now: input.now,
  });
}

export function copyTakeOwnedProjectAssetFileSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet?: ProjectAssetFileWriteSet;
  sourceAssetId: string;
  sourceAssetFileId: string;
  targetAssetId: string;
  targetAssetFileId: string;
  targetTakeId: string;
  role: ShotVideoTakeMediaRole;
  fileRole: string;
  mediaKind: ProjectMediaKind;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  allowDiscardedSource?: boolean;
  now: string;
}): AssetFileRecord {
  const sourceFile = input.allowDiscardedSource
    ? readAssetFileRecordIncludingDiscarded(input.session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      })
    : readAssetFileRecord(input.session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      });
  if (!sourceFile) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SOURCE_RECORD_MISSING',
      `Take-owned source asset file was not found: ${input.sourceAssetFileId}.`
    );
  }
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    sourceFile.projectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  statProjectFileSync(sourcePath, {
    code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    message: `Take-owned source asset file was not found on disk: ${sourceProjectRelativePath}.`,
  });
  const destination = resolveDurableDestinationFileSync({
    session: input.session,
    projectFolder: input.projectFolder,
    destination: {
      kind: 'shotVideoTake.media',
      takeId: input.targetTakeId,
      role: input.role,
    },
    sourceProjectRelativePath,
    mediaKind: input.mediaKind,
    now: input.now,
  });
  return persistProjectAssetFileAtDestinationSync({
    session: input.session,
    projectFolder: input.projectFolder,
    assetId: input.targetAssetId,
    assetFileId: input.targetAssetFileId,
    fileRole: input.fileRole,
    mediaKind: input.mediaKind,
    sourceProjectRelativePath,
    sourcePath,
    destinationProjectRelativePath: destination,
    mimeType: input.mimeType ?? sourceFile.mimeType ?? undefined,
    width: input.width ?? sourceFile.width ?? undefined,
    height: input.height ?? sourceFile.height ?? undefined,
    durationSeconds:
      input.durationSeconds ?? sourceFile.durationSeconds ?? undefined,
    now: input.now,
    writeSet: input.writeSet,
  });
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
      fsSync.copyFileSync(input.sourcePath, destinationPath, fsSync.constants.COPYFILE_EXCL);
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
