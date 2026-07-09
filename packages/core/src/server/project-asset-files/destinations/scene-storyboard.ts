import type { ProjectRelativePath } from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { STORYBOARDS_ROOT, extensionForMediaSource, kebabCasePathSegment } from '../../files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { statProjectFileSync, projectPathExistsSync } from '../file-operations.js';
import { requireSceneHierarchy } from '../owner-lookups.js';
import { allocateProjectRelativeFolderPathSync } from '../path-allocation.js';
import { assertResolvedPathInsideProject } from '../path-guards.js';
import { persistProjectAssetFileAtDestinationSync } from '../persistence.js';
import type { ProjectAssetFileWriteSet } from '../types.js';

export function persistSceneStoryboardShotFilesSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet?: ProjectAssetFileWriteSet;
  sceneId: string;
  files: Array<{
    assetId: string;
    assetFileId: string;
    shotId: string;
    shotOrdinal: number;
    sourceProjectRelativePath: ProjectRelativePath;
  }>;
  now: string;
}): Array<{
  shotId: string;
  assetFile: ReturnType<typeof persistProjectAssetFileAtDestinationSync>;
}> {
  const hierarchy = requireSceneHierarchy(input.session, input.sceneId);
  const iterationFolder = allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      STORYBOARDS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${String(nextStoryboardIterationNumber(input.projectFolder, input.session, input.sceneId)).padStart(2, '0')}-iteration`,
  });
  return input.files.map((file) => {
    const sourceProjectRelativePath = normalizeProjectRelativePath(
      file.sourceProjectRelativePath
    );
    const destination = joinProjectRelativePath(
      iterationFolder,
      `shot-${String(file.shotOrdinal).padStart(2, '0')}${extensionForMediaSource(sourceProjectRelativePath)}`
    );
    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      sourceProjectRelativePath
    );
    assertResolvedPathInsideProject(input.projectFolder, sourcePath);
    statProjectFileSync(sourcePath, {
      code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
      message: `Storyboard source file was not found: ${sourceProjectRelativePath}.`,
    });
    return {
      shotId: file.shotId,
      assetFile: persistProjectAssetFileAtDestinationSync({
        session: input.session,
        projectFolder: input.projectFolder,
        assetId: file.assetId,
        assetFileId: file.assetFileId,
        sourceProjectRelativePath,
        sourcePath,
        destinationProjectRelativePath: destination,
        fileRole: 'storyboard_image',
        mediaKind: 'image',
        now: input.now,
        writeSet: input.writeSet,
      }),
    };
  });
}

function nextStoryboardIterationNumber(
  projectFolder: string,
  session: DatabaseSession,
  sceneId: string
): number {
  const hierarchy = requireSceneHierarchy(session, sceneId);
  const parent = joinProjectRelativePath(
    STORYBOARDS_ROOT,
    kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
    kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
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
