import path from 'node:path';
import type { ProjectRelativePath } from '../../../client/index.js';
import {
  VIDEOS_ROOT,
  extensionForMediaSource,
} from '../../files/asset-paths.js';
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

type ShotPlanVideoReferenceImageDestinationKind =
  'shotPlan.videoReferenceImage';

const VIDEO_REFERENCES_ROOT = joinProjectRelativePath(VIDEOS_ROOT, 'references');

export async function resolveShotPlanVideoReferenceImageDestinationFile(
  input: DestinationFileInput<ShotPlanVideoReferenceImageDestinationKind>,
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: VIDEO_REFERENCES_ROOT,
    ...referenceFileName(input),
  });
}

export function resolveShotPlanVideoReferenceImageDestinationFileSync(
  input: DestinationFileInput<ShotPlanVideoReferenceImageDestinationKind>,
): ProjectRelativePath {
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: VIDEO_REFERENCES_ROOT,
    ...referenceFileName(input),
  });
}

export async function resolveShotPlanVideoReferenceImageDestinationRoot(
  _input: DestinationRootInput<ShotPlanVideoReferenceImageDestinationKind>,
): Promise<ProjectRelativePath> {
  return VIDEO_REFERENCES_ROOT;
}

export function resolveShotPlanVideoReferenceImageDestinationRootSync(
  _input: DestinationRootInput<ShotPlanVideoReferenceImageDestinationKind>,
): ProjectRelativePath {
  return VIDEO_REFERENCES_ROOT;
}

export async function resolveShotPlanVideoReferenceImageDestinationOutputNames(
  input: DestinationOutputNamesInput<ShotPlanVideoReferenceImageDestinationKind>,
): Promise<string[]> {
  return allocateProjectRelativeFileNames({
    projectFolder: input.projectFolder,
    parent: VIDEO_REFERENCES_ROOT,
    ...referenceFileName(input),
    count: input.outputCount,
  });
}

function referenceFileName(
  input:
    | DestinationFileInput<ShotPlanVideoReferenceImageDestinationKind>
    | DestinationOutputNamesInput<ShotPlanVideoReferenceImageDestinationKind>,
) {
  return {
    baseName:
      input.destination.titleHint ??
      path.parse(input.sourceProjectRelativePath).name,
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  };
}
