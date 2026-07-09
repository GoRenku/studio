import path from 'node:path';
import type { ProjectRelativePath } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function assertResolvedPathInsideProject(
  projectFolder: string,
  resolvedPath: string
): void {
  const relative = path.relative(projectFolder, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_PATH_OUTSIDE_PROJECT',
      'Project asset file paths must stay inside the project folder.'
    );
  }
}

export function assertDurableProjectAssetFilePath(
  projectRelativePath: ProjectRelativePath
): void {
  if (
    projectRelativePath === 'generated' ||
    projectRelativePath.startsWith('generated/')
  ) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
      `Durable asset files must not be stored under generated/: ${projectRelativePath}.`
    );
  }
  if (
    projectRelativePath === 'research' ||
    projectRelativePath.startsWith('research/')
  ) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
      `Durable asset files must not be stored under research/: ${projectRelativePath}.`
    );
  }
}
