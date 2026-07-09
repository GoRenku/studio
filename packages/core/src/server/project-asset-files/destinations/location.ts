import type { ProjectRelativePath } from '../../../client/index.js';
import { LOCATIONS_ROOT, extensionForMediaSource } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireLocation } from '../owner-lookups.js';
import {
  allocateProjectRelativeVersionedFileNames,
  allocateProjectRelativeVersionedFilePath,
  allocateProjectRelativeVersionedFilePathSync,
} from '../path-allocation.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type LocationDestinationKind = 'location.environmentSheet' | 'location.hero';

export async function resolveLocationDestinationFile(
  input: DestinationFileInput<LocationDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveLocationDestinationRoot(input),
    ...locationFileName(input),
  });
}

export function resolveLocationDestinationFileSync(
  input: DestinationFileInput<LocationDestinationKind>
): ProjectRelativePath {
  return allocateProjectRelativeVersionedFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveLocationDestinationRootSync(input),
    ...locationFileName(input),
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
  const folder =
    input.destination.kind === 'location.environmentSheet'
      ? 'environment-sheets'
      : 'heroes';
  return joinProjectRelativePath(LOCATIONS_ROOT, location.handle, folder);
}

export async function resolveLocationDestinationOutputNames(
  input: DestinationOutputNamesInput<LocationDestinationKind>
): Promise<string[]> {
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveLocationDestinationRoot(input),
    ...locationFileName(input),
    count: input.outputCount,
  });
}

function locationFileName(
  input:
    | DestinationFileInput<LocationDestinationKind>
    | DestinationOutputNamesInput<LocationDestinationKind>
): { baseName: string; extension: string } {
  return {
    baseName:
      input.destination.kind === 'location.environmentSheet'
        ? input.destination.titleHint ?? 'environment-sheet'
        : input.destination.heroName ?? 'hero',
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
