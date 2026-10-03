import fs from 'node:fs';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { listAllInspirationFolderRecords } from '../database/access/inspiration-folders.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { listActiveInspirationImagesFromFolder } from '../files/inspiration-images.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetFiles } from '../schema/index.js';

const inspirationMimeTypes: Readonly<Record<string, string>> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function resolveMediaGenerationReferenceFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  projectRelativePath: ProjectRelativePath;
}): Promise<{ absolutePath: string; mimeType?: string; mediaKind?: string } | null> {
  const record = input.session.db
    .select({ mimeType: assetFiles.mimeType, mediaKind: assetFiles.mediaKind })
    .from(assetFiles)
    .where(and(
      eq(assetFiles.projectRelativePath, input.projectRelativePath),
      isNull(assetFiles.discardedAt),
    ))
    .get();
  const folder = record ? undefined : listAllInspirationFolderRecords(input.session)
    .find((candidate) => candidate.projectRelativePath === path.posix.dirname(input.projectRelativePath));
  if (!record && !folder) {
    return null;
  }
  const absolutePath = resolveReferenceFilePath(input.projectFolder, input.projectRelativePath);
  if (!absolutePath) {
    return null;
  }
  if (record) {
    return { absolutePath, mimeType: record.mimeType ?? undefined, mediaKind: record.mediaKind };
  }
  if (!folder) {
    return null;
  }
  const folderRoot = path.resolve(fs.realpathSync(input.projectFolder), folder.projectRelativePath);
  assertReferenceContained(folderRoot, absolutePath);
  const images = await listActiveInspirationImagesFromFolder({ ...input, folder });
  if (!images.some((image) => image.projectRelativePath === input.projectRelativePath)) {
    return null;
  }
  return {
    absolutePath,
    mimeType: inspirationMimeTypes[path.extname(input.projectRelativePath).toLowerCase()],
    mediaKind: 'image',
  };
}

function resolveReferenceFilePath(projectFolder: string, projectRelativePath: ProjectRelativePath): string | null {
  let absolutePath: string;
  let projectRoot: string;
  try {
    absolutePath = fs.realpathSync(resolveProjectRelativePath(projectFolder, projectRelativePath));
    projectRoot = fs.realpathSync(projectFolder);
    if (!fs.statSync(absolutePath).isFile()) {
      return null;
    }
  } catch {
    return null;
  }
  assertReferenceContained(projectRoot, absolutePath);
  return absolutePath;
}

function assertReferenceContained(root: string, absolutePath: string): void {
  const relative = path.relative(root, absolutePath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT',
      'Referenced media must remain inside its Project and declared reference folder.',
    );
  }
}
