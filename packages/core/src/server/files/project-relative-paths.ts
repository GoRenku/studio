import path from 'node:path';
import { ProjectDataError } from '../project-data-error.js';
import type { ProjectRelativePath } from '../../client/index.js';

export function normalizeProjectRelativePath(input: string): ProjectRelativePath {
  const normalized = input.replaceAll('\\', '/');
  if (normalized.trim().length === 0) {
    throw invalidProjectRelativePath(input, 'Project-relative path cannot be empty.');
  }
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(input)) {
    throw invalidProjectRelativePath(input, 'Project-relative path cannot be absolute.');
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw invalidProjectRelativePath(
      input,
      'Project-relative path cannot contain parent traversal.'
    );
  }

  const safePath = path.posix.normalize(normalized);
  if (safePath === '.' || safePath.startsWith('../')) {
    throw invalidProjectRelativePath(input, 'Project-relative path is invalid.');
  }

  return safePath as ProjectRelativePath;
}

export function joinProjectRelativePath(
  ...segments: string[]
): ProjectRelativePath {
  return normalizeProjectRelativePath(path.posix.join(...segments));
}

export function resolveProjectRelativePath(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): string {
  return path.resolve(projectFolder, projectRelativePath);
}

function invalidProjectRelativePath(input: string, message: string): ProjectDataError {
  return new ProjectDataError('PROJECT_DATA060', `${message} Received: ${input}`);
}
