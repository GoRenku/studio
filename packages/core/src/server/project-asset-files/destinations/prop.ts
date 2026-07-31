import type { ProjectRelativePath } from '../../../client/index.js';
import { PROPS_ROOT, extensionForMediaSource } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireProp } from '../owner-lookups.js';
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

type PropDestinationKind = 'prop.sheet' | 'prop.hero';

export async function resolvePropDestinationFile(
  input: DestinationFileInput<PropDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent: await resolvePropDestinationRoot(input),
    ...propFileName(input),
  });
}

export function resolvePropDestinationFileSync(
  input: DestinationFileInput<PropDestinationKind>
): ProjectRelativePath {
  return allocateProjectRelativeVersionedFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolvePropDestinationRootSync(input),
    ...propFileName(input),
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
  const folder = input.destination.kind === 'prop.sheet' ? 'prop-sheets' : 'heroes';
  return joinProjectRelativePath(PROPS_ROOT, prop.handle, folder);
}

export async function resolvePropDestinationOutputNames(
  input: DestinationOutputNamesInput<PropDestinationKind>
): Promise<string[]> {
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: await resolvePropDestinationRoot(input),
    ...propFileName(input),
    count: input.outputCount,
  });
}

function propFileName(
  input:
    | DestinationFileInput<PropDestinationKind>
    | DestinationOutputNamesInput<PropDestinationKind>
): { baseName: string; extension: string } {
  return {
    baseName: input.destination.kind === 'prop.sheet'
      ? input.destination.titleHint ?? 'prop-sheet'
      : 'hero',
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
