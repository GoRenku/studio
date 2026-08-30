import type { Asset, AssetFile } from '../../client/assets.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { parseAssetOwnerKey } from '../assets/owner-keys.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { mediaGenerationReferenceProjectPaths } from '../media-generation-review/local-media.js';
import { statProjectFileSync } from '../project-asset-files/file-operations.js';
import { ProjectDataError } from '../project-data-error.js';

export interface VideoEditSource {
  asset: Asset;
  file: AssetFile;
}

export function readVideoEditSource(input: {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  generationProvenance: MediaGenerationProvenance;
}): VideoEditSource {
  const membership = readAssetMembershipRecord(input.session, input.assetId);
  const asset = membership
    ? readOwnedAsset(input.session, {
        owner: parseAssetOwnerKey(membership.ownerKey),
        assetId: input.assetId,
      })
    : null;
  if (!asset || asset.mediaKind !== 'video') {
    throw sourceInvalid();
  }
  if (input.generationProvenance.mediaKind !== 'video') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'video.edit provenance must describe video media.',
    );
  }
  const videoFiles = asset.files.filter((file) => file.mediaKind === 'video');
  if (videoFiles.length === 0) {
    throw sourceInvalid();
  }
  const provenancePaths = mediaGenerationReferenceProjectPaths(
    input.generationProvenance.request,
  );
  const matchedPaths = provenancePaths.filter((projectRelativePath) =>
    videoFiles.some((file) => file.projectRelativePath === projectRelativePath),
  );
  if (matchedPaths.length === 0) {
    throw new ProjectDataError(
      'CORE_VIDEO_EDIT_SOURCE_REFERENCE_MISSING',
      'video.edit provenance must reference one current file from the source Asset.',
    );
  }
  if (matchedPaths.length > 1) {
    throw new ProjectDataError(
      'CORE_VIDEO_EDIT_SOURCE_REFERENCE_AMBIGUOUS',
      'video.edit provenance must reference exactly one current video file from the source Asset.',
    );
  }
  const file = videoFiles.find(
    (candidate) => candidate.projectRelativePath === matchedPaths[0],
  )!;
  statProjectFileSync(
    resolveProjectRelativePath(input.projectFolder, file.projectRelativePath),
    {
      code: 'CORE_VIDEO_EDIT_SOURCE_INVALID',
      message: 'video.edit source AssetFile is not available in the Project folder.',
    },
  );
  return { asset, file };
}

function sourceInvalid(): ProjectDataError {
  return new ProjectDataError(
    'CORE_VIDEO_EDIT_SOURCE_INVALID',
    'video.edit requires an active video Asset with a current video file.',
  );
}
