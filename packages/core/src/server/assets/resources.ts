import type {
  Asset,
  AssetFile,
  AssetOwner,
  AssetPage,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { openProjectStore, type DatabaseSession } from '../database/lifecycle/store.js';
import { isPathInside, resolveProjectFolder } from '../files/project-paths.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readAssetFileRecordIncludingDiscarded, type AssetFileRecord } from '../database/access/asset-files.js';
import type {
  ListAssetPageInput,
  ResolveProjectAssetFileByIdInput,
  ResolveProjectAssetFileInput,
  ResolvedProjectAssetFile,
  ResolvedProjectAssetFileById,
} from '../project-data-service-contracts.js';
import { listAssetPageInSession, listAssetsInSession } from './projection.js';

export async function listAssetPage(
  input: ListAssetPageInput
): Promise<AssetPage> {
  const { session } = await openAssetSession(input);
  try {
    return listAssetPageInSession(session, {
      owner: input.owner,
      localeId: input.locale?.localeId,
      type: input.type,
      mediaKind: input.mediaKind,
      limit: input.limit,
      cursor: input.cursor,
    });
  } finally {
    session.close();
  }
}

export async function listAssets(
  input: {
    projectName: string;
    owner: AssetOwner;
    locale?: { localeId?: string | null };
    type?: string;
    mediaKind?: string;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  const { session } = await openAssetSession(input);
  try {
    return listAssetsInSession(session, {
      owner: input.owner,
      localeId: input.locale?.localeId,
      type: input.type,
      mediaKind: input.mediaKind,
    });
  } finally {
    session.close();
  }
}

export async function resolveProjectAssetFile(
  input: ResolveProjectAssetFileInput
): Promise<ResolvedProjectAssetFile> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const assets = await listAssets({
    projectName: input.projectName,
    owner: input.owner,
    homeDir: input.homeDir,
  });
  const asset = assets.find((candidate) => candidate.id === input.assetId);
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA090',
      `Asset is not owned by the requested owner: ${input.assetId}.`
    );
  }
  const file = asset.files.find((candidate) => candidate.id === input.assetFileId);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA091',
      `Asset file is not attached to the requested asset: ${input.assetFileId}.`
    );
  }
  const absolutePath = resolveProjectRelativePath(projectFolder, file.projectRelativePath);
  if (!isPathInside(projectFolder, absolutePath)) {
    throw new ProjectDataError(
      'PROJECT_DATA088',
      'Asset file must be inside the project folder.'
    );
  }
  return { asset, file, absolutePath };
}

export async function resolveProjectAssetFileById(
  input: ResolveProjectAssetFileByIdInput
): Promise<ResolvedProjectAssetFileById> {
  const { projectFolder, session } = await openAssetSession(input);
  try {
    const asset = readAssetRecord(session, input.assetId);
    if (!asset || asset.discardedAt) {
      throw new ProjectDataError(
        asset ? 'CORE_PROJECT_ASSET_DISCARDED' : 'CORE_PROJECT_ASSET_NOT_FOUND',
        `Project asset is not available: ${input.assetId}.`
      );
    }
    const file = readAssetFileRecordIncludingDiscarded(session, {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    });
    if (!file || file.discardedAt) {
      throw new ProjectDataError(
        file ? 'CORE_PROJECT_ASSET_FILE_DISCARDED' : 'CORE_PROJECT_ASSET_FILE_NOT_FOUND',
        `Project asset file is not available: ${input.assetFileId}.`
      );
    }
    const resolvedFile = toResolvedAssetFile(file);
    const absolutePath = resolveProjectRelativePath(projectFolder, resolvedFile.projectRelativePath);
    if (!isPathInside(projectFolder, absolutePath)) {
      throw new ProjectDataError(
        'CORE_PROJECT_ASSET_FILE_PATH_INVALID',
        'Project asset file must be inside the project folder.'
      );
    }
    return {
      assetId: asset.id,
      assetMediaKind: asset.mediaKind,
      file: resolvedFile,
      absolutePath,
    };
  } finally {
    session.close();
  }
}

async function openAssetSession(input: {
  projectName: string;
  homeDir?: string;
}): Promise<{ projectFolder: string; session: DatabaseSession }> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  return {
    projectFolder,
    session: openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    }),
  };
}

function toResolvedAssetFile(row: AssetFileRecord): AssetFile {
  return {
    id: row.id,
    role: row.role,
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
    mediaKind: row.mediaKind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
  };
}
