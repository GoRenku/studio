import type { ProjectCoverImage } from '../../client/project/index.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetFileOwnerKey } from '../asset-files/owner-keys.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import { requireProjectCoverFile } from './cover-file.js';

export function readSelectedProjectCoverImage(
  session: DatabaseSession
): ProjectCoverImage | null {
  const selected = readSelectedAssetFileRecord(
    session,
    assetFileSelectionTargetKey({ kind: 'project' })
  );
  if (!selected) {
    return null;
  }
  const assetFile = readAssetFileRecordIncludingDiscarded(session, selected.assetFileId);
  const membership = readAssetFileRecordIncludingDiscarded(session, selected.assetFileId);
  if (
    !assetFile
    || assetFile.discardedAt
    || assetFile.availability !== 'ready'
    || assetFile.type !== 'project_cover'
    || assetFile.mediaKind !== 'image'
    || membership?.ownerKey !== assetFileOwnerKey({ kind: 'project' })
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      'The selected Project Cover Asset is missing or has invalid stored ownership or media metadata.'
    );
  }
  const file = requireProjectCoverFile(session, {
    assetFileId: assetFile.id,
    errorCode: 'CORE_ASSET_STORAGE_INVALID',
  });
  return { assetFileId: file.id };
}
