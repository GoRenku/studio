import path from 'node:path';

export const RENKU_PROJECT_DIR = '.renku' as const;
export const RENKU_PROJECT_DATABASE = 'project.sqlite' as const;
export const PROJECT_COVER_IMAGE_FILE = 'cover.png' as const;

export function resolveProjectFolder(storageRoot: string, projectName: string): string {
  return path.join(storageRoot, projectName);
}

export function resolveProjectDatabasePath(projectFolder: string): string {
  return path.join(projectFolder, RENKU_PROJECT_DIR, RENKU_PROJECT_DATABASE);
}

export function resolveProjectCoverImagePath(projectFolder: string): string {
  return path.join(projectFolder, PROJECT_COVER_IMAGE_FILE);
}

export function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
