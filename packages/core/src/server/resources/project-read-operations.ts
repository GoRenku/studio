import { ProjectDataError } from '../project-data-error.js';
import type {
  Asset,
  Project,
  ProjectLibrary,
} from '../../client/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../renku-config.js';
import { listAssets } from './assets.js';
import { readProjectLibrary } from './project-library.js';
import { readProjectFromSession } from './full-project.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import {
  resolveProjectCoverImage as resolveProjectCoverImageFile,
} from '../files/cover-image-files.js';
import {
  isPathInside,
  resolveProjectFolder,
} from '../files/project-paths.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import type {
  ReadProjectInput,
  ResolveProjectAssetFileInput,
  ResolveProjectCoverImageInput,
  ResolvedProjectAssetFile,
} from '../project-data-service-contracts.js';

export async function listLibrary(
  input: RenkuConfigPathOptions = {}
): Promise<ProjectLibrary> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  return await readProjectLibrary({ storageRoot });
}

export async function readProject(input: ReadProjectInput): Promise<Project> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({
    projectFolder,
    create: false,
    lifetime: 'project',
  });
  try {
    return readProjectFromSession({ session, projectFolder });
  } finally {
    session.close();
  }
}

export async function resolveCoverImage(
  input: ResolveProjectCoverImageInput
): Promise<string | null> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const project = await readProject(input);
  return await resolveProjectCoverImageFile({
    storageRoot,
    projectName: input.projectName,
    coverFile: project.coverImage?.fileName ?? null,
  });
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
