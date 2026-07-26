import type { ProjectRelativePath } from '../../../client/index.js';
import { extensionForMediaSource } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireShotInPlan } from '../../database/access/shot-plans/shot-records.js';
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

type ShotDestinationKind = 'shot.image';

export async function resolveShotDestinationFile(
  input: DestinationFileInput<ShotDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeVersionedFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotDestinationRoot(input),
    ...shotFileName(input),
  });
}

export function resolveShotDestinationFileSync(
  input: DestinationFileInput<ShotDestinationKind>
): ProjectRelativePath {
  return allocateProjectRelativeVersionedFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotDestinationRootSync(input),
    ...shotFileName(input),
  });
}

export async function resolveShotDestinationRoot(
  input: DestinationRootInput<ShotDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveShotDestinationRootSync(input);
}

export function resolveShotDestinationRootSync(
  input: DestinationRootInput<ShotDestinationKind>
): ProjectRelativePath {
  requireShotInPlan(input.session, {
    shotPlanId: input.destination.shotPlanId,
    shotId: input.destination.shotId,
  });
  return joinProjectRelativePath(
    'shot-plans',
    input.destination.shotPlanId,
    'shots',
    input.destination.shotId,
    'images'
  );
}

export async function resolveShotDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotDestinationKind>
): Promise<string[]> {
  return allocateProjectRelativeVersionedFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotDestinationRoot(input),
    ...shotFileName(input),
    count: input.outputCount,
  });
}

function shotFileName(
  input:
    | DestinationFileInput<ShotDestinationKind>
    | DestinationOutputNamesInput<ShotDestinationKind>
): { baseName: string; extension: string } {
  return {
    baseName: input.destination.titleHint ?? 'shot-image',
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
