import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireLocation } from '../owner-lookups.js';
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

type LocationDestinationKind = 'location.sheet' | 'location.hero' | 'location.world';

export async function resolveLocationDestinationFile(
  input: DestinationFileInput<LocationDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveLocationDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: locationGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveLocationDestinationFileSync(
  input: DestinationFileInput<LocationDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveLocationDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: locationGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveLocationDestinationRoot(
  input: DestinationRootInput<LocationDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveLocationDestinationRootSync(input);
}

export function resolveLocationDestinationRootSync(
  input: DestinationRootInput<LocationDestinationKind>
): ProjectRelativePath {
  const location = requireLocation(input.session, input.destination.locationId);
  return joinProjectRelativePath('locations', location.handle);
}

export async function resolveLocationDestinationOutputNames(
  input: DestinationOutputNamesInput<LocationDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveLocationDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: locationGeneratedFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function locationGeneratedFileStem(
  input:
    | DestinationFileInput<LocationDestinationKind>
    | DestinationOutputNamesInput<LocationDestinationKind>
): string {
  if (input.namingMode.kind === 'external') {
    return 'external';
  }
  if (input.destination.kind === 'location.sheet') {
    return requiredSemanticFileStem(input.destination.semanticName, 'sheet');
  }
  return fixedFileStem(
    input.destination.kind === 'location.world' ? 'world' : 'hero'
  );
}
