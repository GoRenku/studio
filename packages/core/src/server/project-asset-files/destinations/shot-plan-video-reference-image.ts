import type { ProjectRelativePath } from '../../../client/index.js';
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

type ShotPlanVideoReferenceImageDestinationKind = 'shotPlan.videoReferenceImage';

export async function resolveShotPlanVideoReferenceImageDestinationFile(
  input: DestinationFileInput<ShotPlanVideoReferenceImageDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoReferenceImageDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveShotPlanVideoReferenceImageDestinationFileSync(
  input: DestinationFileInput<ShotPlanVideoReferenceImageDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotPlanVideoReferenceImageDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveShotPlanVideoReferenceImageDestinationRoot(
  input: DestinationRootInput<ShotPlanVideoReferenceImageDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoReferenceImageDestinationRootSync(input);
}

export function resolveShotPlanVideoReferenceImageDestinationRootSync(
  input: DestinationRootInput<ShotPlanVideoReferenceImageDestinationKind>
): ProjectRelativePath {
  return requireShotPlanStorageContext(input.session, input.destination.shotPlanId).root;
}

export async function resolveShotPlanVideoReferenceImageDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotPlanVideoReferenceImageDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoReferenceImageDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: input.destination.role,
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}
