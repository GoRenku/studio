import type { ProjectRelativePath } from '../../../client/index.js';
import { formatProductionNumberForDisplay, isProductionNumber } from '../../../client/production-numbers.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { projectPathExistsSync } from '../file-operations.js';
import { fixedFileStem } from '../naming/safe-segments.js';
import { requireSceneStorageContext } from '../owner-lookups.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
  allocateProjectRelativeFolderPathSync,
} from '../path-allocation.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

type SceneStoryboardDestinationKind = 'scene.storyboardImage';

export function allocateSceneStoryboardIterationFolderSync(input: {
  session: DestinationRootInput<SceneStoryboardDestinationKind>['session'];
  projectFolder: string;
  sceneId: string;
}): ProjectRelativePath {
  const scene = requireSceneStorageContext(input.session, input.sceneId);
  const parent = joinProjectRelativePath('storyboards', scene.pathSegment);
  return allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent,
    baseName: `${String(nextStoryboardIterationNumber(input.projectFolder, parent)).padStart(2, '0')}-iteration`,
  });
}

export async function resolveSceneStoryboardDestinationFile(
  input: DestinationFileInput<SceneStoryboardDestinationKind>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveSceneStoryboardDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: storyboardBeatFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveSceneStoryboardDestinationFileSync(
  input: DestinationFileInput<SceneStoryboardDestinationKind>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveSceneStoryboardDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: storyboardBeatFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveSceneStoryboardDestinationRoot(
  input: DestinationRootInput<SceneStoryboardDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveSceneStoryboardDestinationRootSync(input);
}

export function resolveSceneStoryboardDestinationRootSync(
  input: DestinationRootInput<SceneStoryboardDestinationKind>
): ProjectRelativePath {
  const scene = requireSceneStorageContext(input.session, input.destination.sceneId);
  const expectedParent = joinProjectRelativePath('storyboards', scene.pathSegment);
  if (!input.destination.iterationFolder.startsWith(`${expectedParent}/`)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_STORYBOARD_ITERATION_MISMATCH',
      `Storyboard iteration does not belong to Scene ${input.destination.sceneId}.`
    );
  }
  return input.destination.iterationFolder;
}

export async function resolveSceneStoryboardDestinationOutputNames(
  input: DestinationOutputNamesInput<SceneStoryboardDestinationKind>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveSceneStoryboardDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: storyboardBeatFileStem(input),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function storyboardBeatFileStem(
  input:
    | DestinationFileInput<SceneStoryboardDestinationKind>
    | DestinationOutputNamesInput<SceneStoryboardDestinationKind>
): string {
  if (!isProductionNumber(input.destination.beatNumber)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_BEAT_NUMBER_INVALID',
      `Storyboard Beat number is invalid: ${input.destination.beatNumber}.`
    );
  }
  const scene = requireSceneStorageContext(input.session, input.destination.sceneId);
  return fixedFileStem(
    `s${scene.pathSegment}-b${formatProductionNumberForDisplay(input.destination.beatNumber)}-image`
  );
}

function nextStoryboardIterationNumber(
  projectFolder: string,
  parent: ProjectRelativePath
): number {
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(parent, `${String(index).padStart(2, '0')}-iteration`);
    if (!projectPathExistsSync(projectFolder, candidate)) {
      return index;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    'Could not allocate a storyboard iteration folder.'
  );
}
