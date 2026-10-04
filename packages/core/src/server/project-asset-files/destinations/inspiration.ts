import { requireInspirationFolderRecord } from '../../database/access/inspiration-folders.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ProjectRelativePath } from '../../../client/index.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
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

type InspirationDestinationKind = 'inspiration';

export async function resolveInspirationDestinationFile(
  input: DestinationFileInput<InspirationDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveInspirationDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('inspiration'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveInspirationDestinationFileSync(
  input: DestinationFileInput<InspirationDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveInspirationDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('inspiration'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveInspirationDestinationRoot(
  input: DestinationRootInput<InspirationDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveInspirationDestinationRootSync(input);
}

export function resolveInspirationDestinationRootSync(
  input: DestinationRootInput<InspirationDestinationKind>
): ProjectRelativePath {
  const folder = requireInspirationFolderRecord(input.session, input.destination.folderId);
  const root = normalizeProjectRelativePath(folder.projectRelativePath);
  if (!root.startsWith('visual-language/inspiration/')) {
    throw new ProjectDataError('CORE_REFERENCE_FILE_DESTINATION_INVALID', 'Inspiration directory must stay inside visual-language/inspiration/.');
  }
  return root;
}

export async function resolveInspirationDestinationOutputNames(
  input: DestinationOutputNamesInput<InspirationDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveInspirationDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('inspiration'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}
