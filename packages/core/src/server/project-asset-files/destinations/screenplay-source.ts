import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
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

type ScreenplaySourceKind = 'screenplay.source';

export async function resolveScreenplaySourceDestinationFile(
  input: DestinationFileInput<ScreenplaySourceKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveScreenplaySourceDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveScreenplaySourceDestinationFileSync(
  input: DestinationFileInput<ScreenplaySourceKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveScreenplaySourceDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveScreenplaySourceDestinationRoot(
  input: DestinationRootInput<ScreenplaySourceKind>
): Promise<ProjectRelativePath> {
  return resolveScreenplaySourceDestinationRootSync(input);
}

export function resolveScreenplaySourceDestinationRootSync(
  _input: DestinationRootInput<ScreenplaySourceKind>
): ProjectRelativePath {
  return joinProjectRelativePath('screenplay');
}

export async function resolveScreenplaySourceDestinationOutputNames(
  input: DestinationOutputNamesInput<ScreenplaySourceKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveScreenplaySourceDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}
