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

type ProjectCoverDestinationKind = 'project.cover';

export async function resolveProjectCoverDestinationFile(
  input: DestinationFileInput<ProjectCoverDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveProjectCoverDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('cover'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveProjectCoverDestinationFileSync(
  input: DestinationFileInput<ProjectCoverDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveProjectCoverDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('cover'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveProjectCoverDestinationRoot(
  input: DestinationRootInput<ProjectCoverDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveProjectCoverDestinationRootSync(input);
}

export function resolveProjectCoverDestinationRootSync(
  _input: DestinationRootInput<ProjectCoverDestinationKind>
): ProjectRelativePath {
  return normalizeProjectRelativePath('covers');
}

export async function resolveProjectCoverDestinationOutputNames(
  input: DestinationOutputNamesInput<ProjectCoverDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveProjectCoverDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('cover'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}
