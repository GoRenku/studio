import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assertProjectFilePathWithoutSymlinks, assertResolvedPathInsideProject } from '../project-asset-files/path-guards.js';
import fs from 'node:fs';
import type { AssetFile, AssetFilePage } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import type { ListAssetFilePageInput, ListAssetFilesInput, ResolveProjectAssetFileByIdInput, ResolveProjectAssetFileInput, ResolvedProjectAssetFile } from '../project-data-service-contracts.js';
import { isAssetFileAvailableInSession, listAssetFilePageInSession, listAssetFilesInSession, toAssetFile } from './projection.js';
import { assetFileOwnerKey } from './owner-keys.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';

export async function listAssetFilePage(input: ListAssetFilePageInput): Promise<AssetFilePage> {
  const { session } = await openProjectSession(input);
  try {
    return listAssetFilePageInSession(session, { ...input, localeId: input.locale?.localeId });
  } finally { session.close(); }
}

export async function listAssetFiles(input: ListAssetFilesInput): Promise<AssetFile[]> {
  const { session } = await openProjectSession(input);
  try {
    return listAssetFilesInSession(session, { ...input, localeId: input.locale?.localeId });
  } finally { session.close(); }
}

export async function resolveProjectAssetFile(input: ResolveProjectAssetFileInput): Promise<ResolvedProjectAssetFile> {
  const resolved = await resolveProjectAssetFileById(input);
  if (assetFileOwnerKey(resolved.assetFile.owner) !== assetFileOwnerKey(input.owner)) {
    throw new ProjectDataError('PROJECT_DATA090', 'Retained file is not owned by the requested owner.');
  }
  return resolved;
}

export async function resolveProjectAssetFileById(input: ResolveProjectAssetFileByIdInput): Promise<ResolvedProjectAssetFile> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    return resolveAssetFileInSession({ session, projectFolder, assetFileId: input.assetFileId });
  } finally { session.close(); }
}

export function resolveAssetFileInSession(input: { session: DatabaseSession; projectFolder: string; assetFileId: string }): ResolvedProjectAssetFile {
  const record = readAssetFileRecordIncludingDiscarded(input.session, input.assetFileId);
  if (!record || !isAssetFileAvailableInSession(input.session, record)) {
    throw new ProjectDataError(record ? 'CORE_PROJECT_ASSET_FILE_DISCARDED' : 'CORE_PROJECT_ASSET_FILE_NOT_FOUND', `Retained file is unavailable: ${input.assetFileId}.`);
  }
  const assetFile = toAssetFile(record);
  const absolutePath = resolveProjectRelativePath(input.projectFolder, assetFile.projectRelativePath);
  try {
    assertProjectFilePathWithoutSymlinks(input.projectFolder, assetFile.projectRelativePath);
    assertResolvedPathInsideProject(fs.realpathSync(input.projectFolder), fs.realpathSync(absolutePath));
    if (!fs.statSync(absolutePath).isFile()) { throw new TypeError('Not a regular file'); }
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof ProjectDataError) { throw error; }
    throw new ProjectDataError('CORE_PROJECT_ASSET_FILE_NOT_FOUND', `Retained file is missing or unreadable: ${assetFile.projectRelativePath}.`);
  }
  return { assetFile, absolutePath };
}
