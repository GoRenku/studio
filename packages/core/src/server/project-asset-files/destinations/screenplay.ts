import path from 'node:path';
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

type ScreenplayDestinationKind =
  | 'screenplay.source'
  | 'screenplay.supportingMaterial';

export async function resolveScreenplayDestinationFile<K extends ScreenplayDestinationKind>(
  input: DestinationFileInput<K>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveScreenplayDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: outputFormatHint(input),
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveScreenplayDestinationFileSync<K extends ScreenplayDestinationKind>(
  input: DestinationFileInput<K>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveScreenplayDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: outputFormatHint(input),
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveScreenplayDestinationRoot<K extends ScreenplayDestinationKind>(
  input: DestinationRootInput<K>
): Promise<ProjectRelativePath> {
  return resolveScreenplayDestinationRootSync(input);
}

export function resolveScreenplayDestinationRootSync<K extends ScreenplayDestinationKind>(
  _input: DestinationRootInput<K>
): ProjectRelativePath {
  return joinProjectRelativePath('screenplay');
}

export async function resolveScreenplayDestinationOutputNames<K extends ScreenplayDestinationKind>(
  input: DestinationOutputNamesInput<K>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveScreenplayDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: 'screenplay',
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: outputFormatHint(input),
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

function outputFormatHint<K extends ScreenplayDestinationKind>(
  input: DestinationFileInput<K> | DestinationOutputNamesInput<K>,
): string | undefined {
  if (input.outputFormatHint) {
    return input.outputFormatHint;
  }
  const destination = input.destination as { kind: ScreenplayDestinationKind };
  const extension = path.extname(input.sourceProjectRelativePath);
  return destination.kind === 'screenplay.supportingMaterial'
    && (!extension || extension === '.')
    ? 'bin'
    : undefined;
}
