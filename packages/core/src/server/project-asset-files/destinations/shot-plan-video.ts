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

type ShotPlanVideoDestinationKind = 'shotPlan.video';

export async function resolveShotPlanVideoDestinationFile(
  input: DestinationFileInput<ShotPlanVideoDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveShotPlanVideoDestinationFileSync(
  input: DestinationFileInput<ShotPlanVideoDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotPlanVideoDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveShotPlanVideoDestinationRoot(
  input: DestinationRootInput<ShotPlanVideoDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoDestinationRootSync(input);
}

export function resolveShotPlanVideoDestinationRootSync(
  input: DestinationRootInput<ShotPlanVideoDestinationKind>
): ProjectRelativePath {
  return requireShotPlanStorageContext(input.session, input.destination.shotPlanId).root;
}

export async function resolveShotPlanVideoDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotPlanVideoDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function videoFileStem(
  input:
    | DestinationFileInput<ShotPlanVideoDestinationKind>
    | DestinationOutputNamesInput<ShotPlanVideoDestinationKind>
): string {
  const context = requireShotPlanStorageContext(input.session, input.destination.shotPlanId);
  return `s${context.sceneDisplayNumber}-p${context.shotPlanDisplayNumber}-video`;
}
