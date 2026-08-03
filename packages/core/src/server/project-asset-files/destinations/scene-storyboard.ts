import type { ProjectRelativePath } from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { STORYBOARDS_ROOT, extensionForMediaSource, kebabCasePathSegment } from '../../files/asset-paths.js';
import {
  joinProjectRelativePath,
} from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { projectPathExistsSync } from '../file-operations.js';
import { requireSceneStorageContext } from '../owner-lookups.js';
import { allocateProjectRelativeFolderPathSync } from '../path-allocation.js';
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
  return allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      STORYBOARDS_ROOT,
      kebabCasePathSegment(scene.sceneId, 'scene')
    ),
    baseName: `${String(nextStoryboardIterationNumber(input.projectFolder, input.session, input.sceneId)).padStart(2, '0')}-iteration`,
  });
}

export async function resolveSceneStoryboardDestinationFile(
  input: DestinationFileInput<SceneStoryboardDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveSceneStoryboardDestinationFileSync(input);
}

export function resolveSceneStoryboardDestinationFileSync(
  input: DestinationFileInput<SceneStoryboardDestinationKind>
): ProjectRelativePath {
  requireSceneStorageContext(input.session, input.destination.sceneId);
  return joinProjectRelativePath(
    input.destination.iterationFolder,
    storyboardBeatFileName(input.destination.beatOrdinal, input.sourceProjectRelativePath)
  );
}

export async function resolveSceneStoryboardDestinationRoot(
  input: DestinationRootInput<SceneStoryboardDestinationKind>
): Promise<ProjectRelativePath> {
  return resolveSceneStoryboardDestinationRootSync(input);
}

export function resolveSceneStoryboardDestinationRootSync(
  input: DestinationRootInput<SceneStoryboardDestinationKind>
): ProjectRelativePath {
  requireSceneStorageContext(input.session, input.destination.sceneId);
  return input.destination.iterationFolder;
}

export async function resolveSceneStoryboardDestinationOutputNames(
  input: DestinationOutputNamesInput<SceneStoryboardDestinationKind>
): Promise<string[]> {
  return Array.from(
    { length: input.outputCount },
    (_, index) => storyboardBeatFileName(
      input.destination.beatOrdinal + index,
      input.sourceProjectRelativePath
    )
  );
}

function storyboardBeatFileName(
  beatOrdinal: number,
  sourceProjectRelativePath: ProjectRelativePath
): string {
  return `beat-${String(beatOrdinal).padStart(2, '0')}${extensionForMediaSource(sourceProjectRelativePath)}`;
}

function nextStoryboardIterationNumber(
  projectFolder: string,
  session: DatabaseSession,
  sceneId: string
): number {
  const scene = requireSceneStorageContext(session, sceneId);
  const parent = joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(scene.sceneId, 'scene')
  );
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      `${String(index).padStart(2, '0')}-iteration`
    );
    if (!projectPathExistsSync(projectFolder, candidate)) {
      return index;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_FOLDER_ALLOCATION_FAILED',
    'Could not allocate a storyboard iteration folder.'
  );
}
