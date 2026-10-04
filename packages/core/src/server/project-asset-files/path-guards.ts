import path from 'node:path';
import fs from 'node:fs';
import type { ProjectRelativePath } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';

export function assertProjectFilePathWithoutSymlinks(projectFolder: string, projectRelativePath: ProjectRelativePath): void {
  let absolute = projectFolder;
  for (const segment of projectRelativePath.split('/')) {
    absolute = path.join(absolute, segment);
    try {
      if (fs.lstatSync(absolute).isSymbolicLink()) {
        throw new ProjectDataError('PROJECT_ASSET_FILE_PATH_INVALID', 'Retained file paths cannot contain symbolic links.');
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') { return; }
      throw error;
    }
  }
}

export function assertDurableProjectDirectorySync(projectFolder: string, directory: string): void {
  assertResolvedPathInsideProject(projectFolder, directory);
  let ancestor = directory;
  while (!fs.existsSync(ancestor)) {
    ancestor = path.dirname(ancestor);
  }
  const resolvedProject = fs.realpathSync(projectFolder);
  const resolvedDirectory = path.join(fs.realpathSync(ancestor), path.relative(ancestor, directory));
  assertResolvedPathInsideProject(resolvedProject, resolvedDirectory);
  const relative = path.relative(resolvedProject, resolvedDirectory);
  if (relative === 'tmp' || relative.startsWith(`tmp${path.sep}`)) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_DESTINATION_FORBIDDEN',
      `Retained files must not resolve into Project tmp: ${path.relative(projectFolder, directory)}.`,
      { suggestion: 'Use a retained destination outside Project tmp, and correct any directory links before retrying.' }
    );
  }
}

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

}
