import type {
  Asset,
  AssetLocaleContext,
  AssetTarget,
  PageResponse,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import {
  listAssetRelationshipPage,
  listAssetRelationships,
} from '../database/access/asset-relationships/index.js';
import { openProjectStore, type DatabaseSession } from '../database/lifecycle/store.js';
import {
  isPathInside,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import type {
  ListAssetPageInput,
  ResolveProjectAssetFileInput,
  ResolvedProjectAssetFile,
} from '../project-data-service-contracts.js';

export async function listAssetPage(
  input: ListAssetPageInput
): Promise<PageResponse<Asset>> {
  const { session } = await openAssetSession(input);
  try {
    return listAssetRelationshipPage(session, input);
  } finally {
    session.close();
  }
}

export async function listAssets(
  input: {
    projectName: string;
    target: AssetTarget;
    locale?: AssetLocaleContext;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  const { session } = await openAssetSession(input);
  try {
    return listAssetRelationships(session, {
      target: input.target,
      locale: input.locale,
    });
  } finally {
    session.close();
  }
}

export async function listAssetSelects(
  input: {
    projectName: string;
    target: AssetTarget;
    locale?: AssetLocaleContext;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  return (await listAssets(input)).filter(
    (asset) => asset.selection.kind === 'select'
  );
}

export async function resolveProjectAssetFile(
  input: ResolveProjectAssetFileInput
): Promise<ResolvedProjectAssetFile> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const assets = await listAssets({
    projectName: input.projectName,
    target: input.target,
    homeDir: input.homeDir,
  });
  const asset = findTargetAsset(assets, input.assetId);
  const file = asset.files.find((candidate) => candidate.id === input.assetFileId);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA091',
      `Asset file is not attached to the requested asset: ${input.assetFileId}.`
    );
  }
  const absolutePath = resolveProjectRelativePath(
    projectFolder,
    file.projectRelativePath
  );
  if (!isPathInside(projectFolder, absolutePath)) {
    throw new ProjectDataError(
      'PROJECT_DATA088',
      'Asset file must be inside the project folder.'
    );
  }
  return { asset, file, absolutePath };
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

function findTargetAsset(assets: Asset[], assetId: string): Asset {
  const asset = assets.find((candidate) => candidate.assetId === assetId);
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA090',
      `Asset is not attached to the requested target: ${assetId}.`
    );
  }
  return asset;
}
