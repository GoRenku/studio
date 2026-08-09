import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireProp } from '../owner-lookups.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import {
  fixedFileStem,
  requiredSemanticFileStem,
} from '../naming/safe-segments.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type PropDestinationKind = 'prop.sheet' | 'prop.hero';

export async function resolvePropDestinationFile(
  input: DestinationFileInput<PropDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolvePropDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: propGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolvePropDestinationFileSync(
  input: DestinationFileInput<PropDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolvePropDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: propGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolvePropDestinationRoot(
  input: DestinationRootInput<PropDestinationKind>
): Promise<ProjectRelativePath> {
  return resolvePropDestinationRootSync(input);
}

export function resolvePropDestinationRootSync(
  input: DestinationRootInput<PropDestinationKind>
): ProjectRelativePath {
  const prop = requireProp(input.session, input.destination.propId);
  return joinProjectRelativePath('props', prop.handle);
}

export async function resolvePropDestinationOutputNames(
  input: DestinationOutputNamesInput<PropDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolvePropDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: propGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function propGeneratedFileStem(
  input:
    | DestinationFileInput<PropDestinationKind>
    | DestinationOutputNamesInput<PropDestinationKind>
): string {
  if (input.namingMode.kind === 'external') {
    return 'external';
  }
  return input.destination.kind === 'prop.sheet'
    ? requiredSemanticFileStem(input.destination.semanticName, 'sheet')
    : fixedFileStem('hero');
}
