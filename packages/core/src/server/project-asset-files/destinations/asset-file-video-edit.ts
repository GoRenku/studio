import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import { readAssetFileRecord } from '../../database/access/asset-files.js';
import { readAssetFileRecordIncludingDiscarded } from '../../database/access/asset-files.js';
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

type AssetFileVideoEditDestinationKind = 'assetFile.videoEdit';

export async function resolveAssetFileVideoEditDestinationFile(
  input: DestinationFileInput<AssetFileVideoEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveAssetFileVideoEditDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('edited-video'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveAssetFileVideoEditDestinationFileSync(
  input: DestinationFileInput<AssetFileVideoEditDestinationKind>,
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveAssetFileVideoEditDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('edited-video'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveAssetFileVideoEditDestinationRoot(
  input: DestinationRootInput<AssetFileVideoEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return resolveAssetFileVideoEditDestinationRootSync(input);
}

export function resolveAssetFileVideoEditDestinationRootSync(
  input: DestinationRootInput<AssetFileVideoEditDestinationKind>,
): ProjectRelativePath {
  const assetFile = readAssetFileRecordIncludingDiscarded(input.session, input.destination.sourceAssetFileId);
  const file = readAssetFileRecord(input.session, input.destination.sourceAssetFileId);
  if (
    !assetFile
    || assetFile.discardedAt
    || assetFile.availability !== 'ready'
    || assetFile.mediaKind !== 'video'
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

export async function resolveAssetFileVideoEditDestinationOutputNames(
  input: DestinationOutputNamesInput<AssetFileVideoEditDestinationKind>,
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveAssetFileVideoEditDestinationRoot(input),
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
