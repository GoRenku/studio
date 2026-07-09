import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import { VISUAL_LANGUAGE_ROOT, extensionForMediaSource } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import {
  allocateProjectRelativeFileNames,
  allocateProjectRelativeFilePath,
  allocateProjectRelativeFilePathSync,
} from '../path-allocation.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type LookbookDestinationKind =
  | 'visualLanguage.lookbookImage'
  | 'visualLanguage.lookbookSheet';

export async function resolveLookbookDestinationFile(
  input: DestinationFileInput<LookbookDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveLookbookDestinationRoot(input),
    ...lookbookFileName(input),
  });
}

export function resolveLookbookDestinationFileSync(
  input: DestinationFileInput<LookbookDestinationKind>
): ProjectRelativePath {
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveLookbookDestinationRootSync(input),
    ...lookbookFileName(input),
  });
}

export async function resolveLookbookDestinationRoot(
  input: DestinationRootInput<LookbookDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveLookbookDestinationRootSync(input);
}

export function resolveLookbookDestinationRootSync(
  _input: DestinationRootInput<LookbookDestinationKind>
): ProjectRelativePath {
  return joinProjectRelativePath(VISUAL_LANGUAGE_ROOT, 'lookbook');
}

export async function resolveLookbookDestinationOutputNames(
  input: DestinationOutputNamesInput<LookbookDestinationKind>
): Promise<string[]> {
  return allocateProjectRelativeFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveLookbookDestinationRoot(input),
    ...lookbookFileName(input),
    count: input.outputCount,
  });
}

function lookbookFileName(
  input:
    | DestinationFileInput<LookbookDestinationKind>
    | DestinationOutputNamesInput<LookbookDestinationKind>
): { baseName: string; extension: string } {
  return {
    baseName:
      input.destination.titleHint ??
      path.parse(input.sourceProjectRelativePath).name,
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
