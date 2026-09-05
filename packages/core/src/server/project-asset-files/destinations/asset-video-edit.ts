import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import { readAssetFileRecord } from '../../database/access/asset-files.js';
import { readAssetRecord } from '../../database/access/assets.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import { fixedFileStem } from '../naming/safe-segments.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type AssetVideoEditDestinationKind = 'asset.videoEdit';

export async function resolveAssetVideoEditDestinationFile(
  input: DestinationFileInput<AssetVideoEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveAssetVideoEditDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('edited-video'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveAssetVideoEditDestinationFileSync(
  input: DestinationFileInput<AssetVideoEditDestinationKind>,
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveAssetVideoEditDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('edited-video'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveAssetVideoEditDestinationRoot(
  input: DestinationRootInput<AssetVideoEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return resolveAssetVideoEditDestinationRootSync(input);
}

export function resolveAssetVideoEditDestinationRootSync(
  input: DestinationRootInput<AssetVideoEditDestinationKind>,
): ProjectRelativePath {
  const asset = readAssetRecord(input.session, input.destination.sourceAssetId);
  const file = readAssetFileRecord(input.session, {
    assetId: input.destination.sourceAssetId,
    assetFileId: input.destination.sourceAssetFileId,
  });
  if (
    !asset
    || asset.discardedAt
    || asset.availability !== 'ready'
    || asset.mediaKind !== 'video'
    || !file
    || file.mediaKind !== 'video'
  ) {
    throw sourceInvalid();
  }
  const sourcePath = normalizeProjectRelativePath(file.projectRelativePath);
  const parent = path.posix.dirname(sourcePath);
  if (parent === '.') {
    throw new ProjectDataError(
      'CORE_VIDEO_EDIT_SOURCE_INVALID',
      'video.edit requires its source AssetFile to be stored in a registered Project directory.',
    );
  }
  return normalizeProjectRelativePath(parent);
}

export async function resolveAssetVideoEditDestinationOutputNames(
  input: DestinationOutputNamesInput<AssetVideoEditDestinationKind>,
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveAssetVideoEditDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('edited-video'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

function sourceInvalid(): ProjectDataError {
  return new ProjectDataError(
    'CORE_VIDEO_EDIT_SOURCE_INVALID',
    'video.edit requires an active registered video AssetFile.',
  );
}
