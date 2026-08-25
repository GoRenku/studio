import type { Asset } from '../../client/assets.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { readOwnedAsset } from '../assets/projection.js';
import { parseAssetOwnerKey } from '../assets/owner-keys.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { mediaGenerationReferenceProjectPaths } from '../media-generation-review/local-media.js';
import { ProjectDataError } from '../project-data-error.js';

export function readImageEditSource(input: {
  session: DatabaseSession;
  assetId: string;
  generationProvenance: MediaGenerationProvenance;
}): Asset {
  const membership = readAssetMembershipRecord(input.session, input.assetId);
  const source = membership
    ? readOwnedAsset(input.session, {
        owner: parseAssetOwnerKey(membership.ownerKey),
        assetId: input.assetId,
      })
    : null;
  if (!source || source.mediaKind !== 'image') {
    throw sourceInvalid();
  }
  const imageFiles = source.files.filter((file) => file.mediaKind === 'image');
  if (imageFiles.length === 0) {
    throw sourceInvalid();
  }
  const provenancePaths = new Set(
    mediaGenerationReferenceProjectPaths(input.generationProvenance.request),
  );
  if (!imageFiles.some((file) => provenancePaths.has(file.projectRelativePath))) {
    throw new ProjectDataError(
      'CORE_IMAGE_EDIT_SOURCE_REFERENCE_MISSING',
      'image.edit provenance must reference a current file from the source Asset.',
    );
  }
  if (input.generationProvenance.mediaKind !== 'image') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'image.edit provenance must describe image media.',
    );
  }
  return source;
}

function sourceInvalid(): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_SOURCE_INVALID',
    'image.edit requires an active image Asset with a current image file.',
  );
}
