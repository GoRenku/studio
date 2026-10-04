import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import { resolveAssetFileInSession } from '../../asset-files/resources.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type ImageEditDestinationKind = 'assetFile.imageEdit';

export async function resolveAssetFileImageEditDestinationFile(
  input: DestinationFileInput<ImageEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    ...input,
    parent: resolveAssetFileImageEditDestinationRootSync(input),
    generatedBaseName: 'edited-image',
  });
}

export function resolveAssetFileImageEditDestinationFileSync(
  input: DestinationFileInput<ImageEditDestinationKind>,
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    ...input,
    parent: resolveAssetFileImageEditDestinationRootSync(input),
    generatedBaseName: 'edited-image',
  });
}

export async function resolveAssetFileImageEditDestinationRoot(
  input: DestinationRootInput<ImageEditDestinationKind>,
): Promise<ProjectRelativePath> {
  return resolveAssetFileImageEditDestinationRootSync(input);
}

export function resolveAssetFileImageEditDestinationRootSync(
  input: DestinationRootInput<ImageEditDestinationKind>,
): ProjectRelativePath {
  const { assetFile } = resolveAssetFileInSession({
    ...input,
    assetFileId: input.destination.sourceAssetFileId,
  });
  if (assetFile.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_INVALID',
      'image.edit requires an active registered image AssetFile.',
    );
  }
  return normalizeProjectRelativePath(path.posix.dirname(assetFile.projectRelativePath));
}

export async function resolveAssetFileImageEditDestinationOutputNames(
  input: DestinationOutputNamesInput<ImageEditDestinationKind>,
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    ...input,
    parent: resolveAssetFileImageEditDestinationRootSync(input),
    generatedBaseName: 'edited-image',
    count: input.outputCount,
  });
}
