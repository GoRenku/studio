import type { AssetFileRecord } from '../database/access/asset-files.js';
import { readAssetFileRecord } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export function requireProjectCoverFile(
  session: DatabaseSession,
  input: {
    assetFileId: string;
    errorCode: 'CORE_ASSET_SELECTION_INVALID' | 'CORE_ASSET_STORAGE_INVALID';
  }
): AssetFileRecord {
  const file = readAssetFileRecord(session, input.assetFileId);
  if (!file || file.type !== 'project_cover' || file.mediaKind !== 'image') {
    throw new ProjectDataError(
      input.errorCode,
      'Project Covers require an active image AssetFile.'
    );
  }
  return file;
}
