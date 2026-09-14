import fs from 'node:fs/promises';
import path from 'node:path';
import type { InspirationImage } from '../../client/index.js';
import type { InspirationFolderRecord } from '../database/access/inspiration-folders.js';
import { listActiveTrashItemOriginalProjectRelativePaths } from '../database/access/trash.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
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

export async function listActiveInspirationImagesFromFolder(input: {
  session: DatabaseSession;
  projectFolder: string;
  folder: InspirationFolderRecord;
}): Promise<InspirationImage[]> {
  const discardedPaths = new Set(
    listActiveTrashItemOriginalProjectRelativePaths(input.session, {
      itemKind: 'inspirationImage',
      ownerKind: 'inspirationFolder',
      ownerId: input.folder.id,
    })
  );
  const images = await listInspirationImagesFromFolder(
    input.projectFolder,
    input.folder
  );
  return images.filter(
    (image) => !discardedPaths.has(image.projectRelativePath)
  );
}

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
