import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
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

export async function resolveShotPlanVideoDestinationFile(
  input: DestinationFileInput<'shotPlan.video'> | DestinationFileInput<'shotPlan.previs'>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export function resolveShotPlanVideoDestinationFileSync(
  input: DestinationFileInput<'shotPlan.video'> | DestinationFileInput<'shotPlan.previs'>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotPlanVideoDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

export async function resolveShotPlanVideoDestinationRoot(
  input: DestinationRootInput<'shotPlan.video'> | DestinationRootInput<'shotPlan.previs'>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoDestinationRootSync(input);
}

export function resolveShotPlanVideoDestinationRootSync(
  input: DestinationRootInput<'shotPlan.video'> | DestinationRootInput<'shotPlan.previs'>
): ProjectRelativePath {
  const root = requireShotPlanStorageContext(input.session, input.destination.shotPlanId).root;
  return input.destination.kind === 'shotPlan.previs'
    ? joinProjectRelativePath(root, 'previs', 'renders')
    : root;
}

export async function resolveShotPlanVideoDestinationOutputNames(
  input: DestinationOutputNamesInput<'shotPlan.video'> | DestinationOutputNamesInput<'shotPlan.previs'>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanVideoDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: videoFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
    reservedProjectRelativePaths: input.reservedProjectRelativePaths,
  });
}

function videoFileStem(
  input:
    | DestinationFileInput<'shotPlan.video'> | DestinationFileInput<'shotPlan.previs'>
    | DestinationOutputNamesInput<'shotPlan.video'> | DestinationOutputNamesInput<'shotPlan.previs'>
): string {
  if (input.destination.kind === 'shotPlan.previs') {
    return 'previs';
  }
  const context = requireShotPlanStorageContext(input.session, input.destination.shotPlanId);
  return `s${context.scenePathSegment}-p${context.shotPlanDisplayNumber}-video`;
}
