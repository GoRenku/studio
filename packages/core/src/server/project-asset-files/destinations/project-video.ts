import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import {
  VIDEOS_ROOT,
  extensionForMediaSource,
} from '../../files/asset-paths.js';
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

export async function resolveProjectVideoDestinationFile(
  input: DestinationFileInput<'project.video'>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveProjectVideoDestinationRoot(input),
    ...projectVideoFileName(input),
  });
}

export function resolveProjectVideoDestinationFileSync(
  input: DestinationFileInput<'project.video'>
): ProjectRelativePath {
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveProjectVideoDestinationRootSync(input),
    ...projectVideoFileName(input),
  });
}

export async function resolveProjectVideoDestinationRoot(
  _input: DestinationRootInput<'project.video'>
): Promise<ProjectRelativePath> {
  return VIDEOS_ROOT;
}

export function resolveProjectVideoDestinationRootSync(
  _input: DestinationRootInput<'project.video'>
): ProjectRelativePath {
  return VIDEOS_ROOT;
}

export async function resolveProjectVideoDestinationOutputNames(
  input: DestinationOutputNamesInput<'project.video'>
): Promise<string[]> {
  return allocateProjectRelativeFileNames({
    projectFolder: input.projectFolder,
    parent: VIDEOS_ROOT,
    ...projectVideoFileName(input),
    count: input.outputCount,
  });
}

function projectVideoFileName(
  input:
    | DestinationFileInput<'project.video'>
    | DestinationOutputNamesInput<'project.video'>
): { baseName: string; extension: string } {
  return {
    baseName:
      input.destination.titleHint?.trim() ||
      path.parse(input.sourceProjectRelativePath).name ||
      'generated-video',
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
