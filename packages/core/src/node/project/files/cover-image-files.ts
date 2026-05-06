import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectDataError } from '../../../project/index.js';
import {
  PROJECT_COVER_IMAGE_FILE,
  isPathInside,
  resolveProjectCoverImagePath,
  resolveProjectFolder,
} from './project-paths.js';

export async function copyProjectCoverImage(input: {
  coverPath: string | undefined;
  projectFolder: string;
}): Promise<string | null> {
  if (!input.coverPath) {
    return null;
  }
  await validateCoverImage(input.coverPath);
  const targetPath = resolveProjectCoverImagePath(input.projectFolder);
  await fs.copyFile(input.coverPath, targetPath);
  return targetPath;
}

export async function resolveProjectCoverImage(input: {
  storageRoot: string;
  projectName: string;
  coverFile: string | null;
}): Promise<string | null> {
  if (!input.coverFile) {
    return null;
  }
  if (input.coverFile !== PROJECT_COVER_IMAGE_FILE) {
    throw new ProjectDataError(
      'PROJECT_DATA030',
      `Unsupported project cover image file: ${input.coverFile}.`
    );
  }

  const projectFolder = resolveProjectFolder(input.storageRoot, input.projectName);
  const coverPath = resolveProjectCoverImagePath(projectFolder);
  if (!isPathInside(projectFolder, coverPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA031',
      'Resolved cover image path is outside the project folder.'
    );
  }

  try {
    const stats = await fs.stat(coverPath);
    return stats.isFile() ? coverPath : null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function validateCoverImage(coverPath: string): Promise<void> {
  if (path.extname(coverPath).toLowerCase() !== '.png') {
    throw new ProjectDataError('PROJECT_DATA032', 'Cover image must be a PNG file.');
  }
  const stats = await fs.stat(coverPath);
  if (!stats.isFile()) {
    throw new ProjectDataError(
      'PROJECT_DATA033',
      `Cover image is not a file: ${coverPath}`
    );
  }
}
