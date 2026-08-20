import type { ProjectCoverImage } from '../../client/project/index.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetOwnerKey } from '../assets/owner-keys.js';
import { assetSelectionTargetKey } from '../assets/selection-targets.js';
import { requireProjectCoverPrimaryImage } from './primary-image.js';

export function readSelectedProjectCoverImage(
  session: DatabaseSession
): ProjectCoverImage | null {
  const selected = readSelectedAssetRecord(
    session,
    assetSelectionTargetKey({ kind: 'project' })
  );
  if (!selected) {
    return null;
  }
  const asset = readAssetRecord(session, selected.assetId);
  const membership = readAssetMembershipRecord(session, selected.assetId);
  if (
    !asset
    || asset.discardedAt
    || asset.availability !== 'ready'
    || asset.type !== 'project_cover'
    || asset.mediaKind !== 'image'
    || membership?.ownerKey !== assetOwnerKey({ kind: 'project' })
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      'The selected Project Cover Asset is missing or has invalid stored ownership or media metadata.'
    );
  }
  const file = requireProjectCoverPrimaryImage(session, {
    assetId: asset.id,
    errorCode: 'CORE_ASSET_STORAGE_INVALID',
  });
  return { assetId: asset.id, assetFileId: file.id };
}
