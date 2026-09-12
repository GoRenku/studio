import type { ProjectRelativePath } from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import { requireShotPlanStorageContext } from './shot-plan.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type ShotPlanVideoReferenceDestinationKind = 'shotPlan.videoReference';

export async function resolveShotPlanVideoReferenceDestinationFile(
  input: DestinationFileInput<ShotPlanVideoReferenceDestinationKind>
): Promise<ProjectRelativePath> {
  validateReferenceMedia(input);
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoReferenceDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveShotPlanVideoReferenceDestinationFileSync(
  input: DestinationFileInput<ShotPlanVideoReferenceDestinationKind>
): ProjectRelativePath {
  validateReferenceMedia(input);
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotPlanVideoReferenceDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveShotPlanVideoReferenceDestinationRoot(
  input: DestinationRootInput<ShotPlanVideoReferenceDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoReferenceDestinationRootSync(input);
}

export function resolveShotPlanVideoReferenceDestinationRootSync(
  input: DestinationRootInput<ShotPlanVideoReferenceDestinationKind>
): ProjectRelativePath {
  return requireShotPlanStorageContext(input.session, input.destination.shotPlanId).root;
}

export async function resolveShotPlanVideoReferenceDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotPlanVideoReferenceDestinationKind>
): Promise<string[]> {
  validateReferenceMedia(input);
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoReferenceDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

function validateReferenceMedia(input: Pick<DestinationFileInput<ShotPlanVideoReferenceDestinationKind>, 'destination' | 'mediaKind'>): void {
  if (input.mediaKind === 'image') {
    return;
  }
  if (input.destination.role === 'reference' && (input.mediaKind === 'video' || input.mediaKind === 'audio')) {
    return;
  }
  throw new ProjectDataError('CORE_SHOT_PLAN_REFERENCE_MEDIA_INVALID', 'Only reference media may contain video or audio; frame and storyboard Assets require images.');
}
