import fs from 'node:fs';
import type { ProjectRelativePath } from '../../client/project/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readAssetFileRecordByPath } from '../database/access/asset-files.js';
import { resolveAssetFileInSession } from '../asset-files/resources.js';
import { isAssetFileAvailableInSession } from '../asset-files/projection.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { assertProjectFilePathWithoutSymlinks } from '../project-asset-files/path-guards.js';
import { ProjectDataError } from '../project-data-error.js';

type ReferenceFileResolution =
  | { status: 'available'; absolutePath: string; mimeType?: string; mediaKind: string }
  | { status: 'unavailable' | 'untracked' };

export async function resolveMediaGenerationReferenceFile(input: {
  session: DatabaseSession; projectFolder: string; projectRelativePath: ProjectRelativePath;
}): Promise<ReferenceFileResolution> {
  const record = readAssetFileRecordByPath(input.session, input.projectRelativePath);
  if (!record) {
    const absolutePath = resolveProjectRelativePath(input.projectFolder, input.projectRelativePath);
    try {
      assertProjectFilePathWithoutSymlinks(input.projectFolder, input.projectRelativePath);
      return { status: fs.statSync(absolutePath).isFile() ? 'untracked' : 'unavailable' };
    } catch (error) {
      if (error instanceof Error && 'code' in error
        && ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(String(error.code))) {
        return { status: 'unavailable' };
      }
      throw error;
    }
  }
  if (!isAssetFileAvailableInSession(input.session, record)) { return { status: 'unavailable' }; }
  try {
    const resolved = resolveAssetFileInSession({ ...input, assetFileId: record.id });
    return { status: 'available', absolutePath: resolved.absolutePath, mimeType: record.mimeType ?? undefined, mediaKind: record.mediaKind };
  } catch (error) {
    if (error instanceof ProjectDataError && error.code === 'CORE_PROJECT_ASSET_FILE_NOT_FOUND') {
      return { status: 'unavailable' };
    }
    throw error;
  }
}
