import type { ProjectRelativePath } from '../../../client/index.js';
import { formatProductionNumberForDisplay, isProductionNumber } from '../../../client/production-numbers.js';
import { requireShotInPlan } from '../../database/access/shot-plans/shot-records.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
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

type ShotDestinationKind = 'shot.image';

export async function resolveShotDestinationFile(
  input: DestinationFileInput<ShotDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: shotFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveShotDestinationFileSync(
  input: DestinationFileInput<ShotDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: shotFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
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
    requireShotPlanStorageContext(input.session, input.destination.shotPlanId).root,
    'shot-images'
  );
}

export async function resolveShotDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: shotFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function shotFileStem(
  input:
    | DestinationFileInput<ShotDestinationKind>
    | DestinationOutputNamesInput<ShotDestinationKind>
): string {
  const shot = requireShotInPlan(input.session, {
    shotPlanId: input.destination.shotPlanId,
    shotId: input.destination.shotId,
  });
  if (!isProductionNumber(shot.number)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SHOT_NUMBER_INVALID',
      `Shot ${shot.id} has an invalid production number: ${shot.number}.`
    );
  }
  return `shot${formatProductionNumberForDisplay(shot.number)}`;
}
