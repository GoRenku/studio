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

type ResearchDestinationKind = 'research';

export async function resolveResearchDestinationFile(
  input: DestinationFileInput<ResearchDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveResearchDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('research'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveResearchDestinationFileSync(
  input: DestinationFileInput<ResearchDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveResearchDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('research'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveResearchDestinationRoot(
  input: DestinationRootInput<ResearchDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveResearchDestinationRootSync(input);
}

export function resolveResearchDestinationRootSync(
  _input: DestinationRootInput<ResearchDestinationKind>
): ProjectRelativePath {
  return normalizeProjectRelativePath('research');
}

export async function resolveResearchDestinationOutputNames(
  input: DestinationOutputNamesInput<ResearchDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveResearchDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: fixedFileStem('research'),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}
