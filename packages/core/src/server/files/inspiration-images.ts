import fs from 'node:fs/promises';
import path from 'node:path';
import type { InspirationImage } from '../../client/index.js';
import type { InspirationFolderRecord } from '../database/access/inspiration-folders.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from './project-relative-paths.js';

const imageExtensions = new Set([
  '.apng',
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

export async function listInspirationImagesFromFolder(
  projectFolder: string,
  folder: InspirationFolderRecord
): Promise<InspirationImage[]> {
  const folderPath = normalizeProjectRelativePath(folder.projectRelativePath);
  const absoluteFolderPath = resolveProjectRelativePath(projectFolder, folderPath);
  let entries: Array<{ name: string; isFile(): boolean }>;
  try {
    entries = await fs.readdir(absoluteFolderPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const images: InspirationImage[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const projectRelativePath = joinProjectRelativePath(folderPath, entry.name);
    const stats = await fs.stat(resolveProjectRelativePath(projectFolder, projectRelativePath));
    images.push({
      fileName: entry.name,
      projectRelativePath,
      mediaKind: 'image',
      sizeBytes: stats.size,
    });
  }
  return images.sort((a, b) => a.fileName.localeCompare(b.fileName));
}
