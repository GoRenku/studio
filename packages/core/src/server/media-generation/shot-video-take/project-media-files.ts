import type {
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../../files/project-relative-paths.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';



export async function deleteProjectRelativeFile(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath
): Promise<void> {
  const normalizedPath = normalizeProjectRelativePath(projectRelativePath);
  const absolutePath = resolveProjectRelativePath(projectFolder, normalizedPath);
  assertResolvedPathInsideProject(projectFolder, absolutePath);
  await fs.rm(absolutePath, { force: true });
}



export async function statExistingFile(filePath: string): Promise<{ size: number; isFile(): boolean }> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('not a file');
    }
    return stats;
  } catch {
    throw new ProjectDataError('PROJECT_DATA382', `Shot video take import source file was not found: ${filePath}.`);
  }
}



export async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(filePath));
  return hash.digest('hex');
}



export function assertResolvedPathInsideProject(projectFolder: string, resolvedPath: string): void {
  const relative = path.relative(projectFolder, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError('PROJECT_DATA383', 'Shot video take import source must stay inside the project folder.');
  }
}



export function mimeTypeForPath(filePath: ProjectRelativePath, mediaKind: 'image' | 'video'): string {
  const extension = path.extname(filePath).toLowerCase();
  if (mediaKind === 'video') {
    return extension === '.mov' ? 'video/quicktime' : 'video/mp4';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}
