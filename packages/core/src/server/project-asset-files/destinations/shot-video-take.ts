import type { ProjectRelativePath } from '../../../client/index.js';
import { assignSceneShotVideoTakeMediaFolder } from '../../database/access/project-asset-file-storage.js';
import { SHOTS_ROOT, extensionForMediaSource, kebabCasePathSegment } from '../../files/asset-paths.js';
import { joinProjectRelativePath, normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readSceneShotVideoTakeStorageRecord, requireSceneHierarchy, stableTakeNumber } from '../owner-lookups.js';
import {
  allocateProjectRelativeFileNames,
  allocateProjectRelativeFilePath,
  allocateProjectRelativeFilePathSync,
  allocateProjectRelativeFolderPath,
  allocateProjectRelativeFolderPathSync,
} from '../path-allocation.js';
import type { ShotVideoTakeMediaRole } from '../types.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

export async function resolveShotVideoTakeDestinationFile(
  input: DestinationFileInput<'shotVideoTake.media'>
): Promise<ProjectRelativePath> {
  return allocateProjectRelativeFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotVideoTakeDestinationRoot(input),
    baseName: shotVideoTakeMediaBaseName(input.destination.role),
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  });
}

export function resolveShotVideoTakeDestinationFileSync(
  input: DestinationFileInput<'shotVideoTake.media'>
): ProjectRelativePath {
  return allocateProjectRelativeFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotVideoTakeDestinationRootSync(input),
    baseName: shotVideoTakeMediaBaseName(input.destination.role),
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
  });
}

export async function resolveShotVideoTakeDestinationRoot(
  input: DestinationRootInput<'shotVideoTake.media'>
): Promise<ProjectRelativePath> {
  return resolveShotVideoTakeMediaFolder({
    session: input.session,
    projectFolder: input.projectFolder,
    takeId: input.destination.takeId,
    now: input.now,
  });
}

export function resolveShotVideoTakeDestinationRootSync(
  input: DestinationRootInput<'shotVideoTake.media'>
): ProjectRelativePath {
  return resolveShotVideoTakeMediaFolderSync({
    session: input.session,
    projectFolder: input.projectFolder,
    takeId: input.destination.takeId,
    now: input.now,
  });
}

export async function resolveShotVideoTakeDestinationOutputNames(
  input: DestinationOutputNamesInput<'shotVideoTake.media'>
): Promise<string[]> {
  return allocateProjectRelativeFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotVideoTakeDestinationRoot(input),
    baseName: shotVideoTakeMediaBaseName(input.destination.role),
    extension: extensionForMediaSource(input.sourceProjectRelativePath),
    count: input.outputCount,
  });
}

export async function resolveShotVideoTakeMediaFolder(input: {
  session: DestinationRootInput<'shotVideoTake.media'>['session'];
  projectFolder: string;
  takeId: string;
  now: string;
}): Promise<ProjectRelativePath> {
  const row = readSceneShotVideoTakeStorageRecord(input.session, input.takeId);
  if (row.mediaFolderProjectRelativePath) {
    return normalizeProjectRelativePath(row.mediaFolderProjectRelativePath);
  }
  const hierarchy = requireSceneHierarchy(input.session, row.sceneId);
  const folder = await allocateProjectRelativeFolderPath({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      SHOTS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${kebabCasePathSegment(row.title, 'take')}-${stableTakeNumber(
      input.session,
      row.sceneId,
      row.id
    )}`,
  });
  assignSceneShotVideoTakeMediaFolder(input.session, {
    takeId: row.id,
    mediaFolderProjectRelativePath: folder,
    now: input.now,
  });
  return folder;
}

export function resolveShotVideoTakeMediaFolderSync(input: {
  session: DestinationRootInput<'shotVideoTake.media'>['session'];
  projectFolder: string;
  takeId: string;
  now: string;
}): ProjectRelativePath {
  const row = readSceneShotVideoTakeStorageRecord(input.session, input.takeId);
  if (row.mediaFolderProjectRelativePath) {
    return normalizeProjectRelativePath(row.mediaFolderProjectRelativePath);
  }
  const hierarchy = requireSceneHierarchy(input.session, row.sceneId);
  const folder = allocateProjectRelativeFolderPathSync({
    projectFolder: input.projectFolder,
    parent: joinProjectRelativePath(
      SHOTS_ROOT,
      kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
      kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
    ),
    baseName: `${kebabCasePathSegment(row.title, 'take')}-${stableTakeNumber(
      input.session,
      row.sceneId,
      row.id
    )}`,
  });
  assignSceneShotVideoTakeMediaFolder(input.session, {
    takeId: row.id,
    mediaFolderProjectRelativePath: folder,
    now: input.now,
  });
  return folder;
}

function shotVideoTakeMediaBaseName(role: ShotVideoTakeMediaRole): string {
  switch (role) {
    case 'first-frame':
      return 'first-frame';
    case 'last-frame':
      return 'last-frame';
    case 'reference-image':
      return 'reference-image';
    case 'video-prompt-sheet':
      return 'video-prompt-sheet';
    case 'video':
      return 'video';
    default:
      return kebabCasePathSegment(role, 'media');
  }
}

export function unsupportedShotVideoTakeDestination(value: never): never {
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_UNSUPPORTED_DESTINATION',
    `Unsupported shot video take asset destination: ${JSON.stringify(value)}.`
  );
}
