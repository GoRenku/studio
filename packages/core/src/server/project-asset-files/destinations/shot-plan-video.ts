import type { ProjectRelativePath } from '../../../client/index.js';
import {
  SHOTS_ROOT,
  extensionForMediaSource,
  kebabCasePathSegment,
} from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { requireShotPlanRecord } from '../../database/access/shot-plans.js';
import { requireSceneHierarchy } from '../owner-lookups.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

export async function resolveShotPlanVideoDestinationFile(
  input: DestinationFileInput<'shotPlan.video'>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoDestinationFileSync(input);
}

export function resolveShotPlanVideoDestinationFileSync(
  input: DestinationFileInput<'shotPlan.video'>
): ProjectRelativePath {
  return joinProjectRelativePath(
    resolveShotPlanVideoDestinationRootSync(input),
    `video${extensionForMediaSource(input.sourceProjectRelativePath)}`
  );
}

export async function resolveShotPlanVideoDestinationRoot(
  input: DestinationRootInput<'shotPlan.video'>
): Promise<ProjectRelativePath> {
  return resolveShotPlanVideoDestinationRootSync(input);
}

export function resolveShotPlanVideoDestinationRootSync(
  input: DestinationRootInput<'shotPlan.video'>
): ProjectRelativePath {
  const shotPlan = requireShotPlanRecord(
    input.session,
    input.destination.shotPlanId
  );
  const hierarchy = requireSceneHierarchy(input.session, shotPlan.sceneId);
  return joinProjectRelativePath(
    SHOTS_ROOT,
    kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
    kebabCasePathSegment(hierarchy.sceneTitle, 'scene'),
    shotPlan.id
  );
}

export async function resolveShotPlanVideoDestinationOutputNames(
  input: DestinationOutputNamesInput<'shotPlan.video'>
): Promise<string[]> {
  return [
    resolveShotPlanVideoDestinationFileSync(input).split('/').at(-1)!,
  ];
}
