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

type ShotPlanVideoDestinationKind = 'shotPlan.video';

export async function resolveShotPlanVideoDestinationFile(
  input: DestinationFileInput<ShotPlanVideoDestinationKind>,
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: VIDEOS_ROOT,
    ...videoFileName(input),
  });
}

export function resolveShotPlanVideoDestinationFileSync(
  input: DestinationFileInput<ShotPlanVideoDestinationKind>,
): ProjectRelativePath {
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: VIDEOS_ROOT,
    ...videoFileName(input),
  });
}

export async function resolveShotPlanVideoDestinationRoot(
  _input: DestinationRootInput<ShotPlanVideoDestinationKind>,
): Promise<ProjectRelativePath> {
  return VIDEOS_ROOT;
}

export function resolveShotPlanVideoDestinationRootSync(
  _input: DestinationRootInput<ShotPlanVideoDestinationKind>,
): ProjectRelativePath {
  return VIDEOS_ROOT;
}

export async function resolveShotPlanVideoDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotPlanVideoDestinationKind>,
): Promise<string[]> {
  return allocateProjectRelativeFileNames({
    projectFolder: input.projectFolder,
    parent: VIDEOS_ROOT,
    ...videoFileName(input),
    count: input.outputCount,
  });
}

function videoFileName(
  input:
    | DestinationFileInput<ShotPlanVideoDestinationKind>
    | DestinationOutputNamesInput<ShotPlanVideoDestinationKind>,
) {
  return {
    baseName:
      input.destination.titleHint ??
      path.parse(input.sourceProjectRelativePath).name,
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
