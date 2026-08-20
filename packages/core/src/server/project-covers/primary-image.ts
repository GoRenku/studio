import type { AssetFileRecord } from '../database/access/asset-files.js';
import { listAssetFileRecordsForAsset } from '../database/access/asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export function requireProjectCoverPrimaryImage(
  session: DatabaseSession,
  input: {
    assetId: string;
    errorCode: 'CORE_ASSET_SELECTION_INVALID' | 'CORE_ASSET_STORAGE_INVALID';
  }
): AssetFileRecord {
  const primaryImages = listAssetFileRecordsForAsset(session, input.assetId)
    .filter((file) => file.role === 'primary' && file.mediaKind === 'image');
  const activePrimaryFiles = listAssetFileRecordsForAsset(session, input.assetId)
    .filter((file) => file.role === 'primary');
  if (primaryImages.length !== 1 || activePrimaryFiles.length !== 1) {
    throw new ProjectDataError(
      input.errorCode,
      'Project Cover Assets require exactly one active primary image Asset File.'
    );
  }
  return primaryImages[0]!;
}
