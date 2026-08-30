import { readAssetMembershipRecord } from '../../database/access/asset-memberships.js';
import { parseAssetOwnerKey } from '../../assets/owner-keys.js';
import { readOwnedAsset } from '../../assets/projection.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion } from '../reference-suggestions.js';

export const buildAssetPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'asset') {
    throw invalidTarget();
  }
  const membership = readAssetMembershipRecord(input.session, input.target.id);
  const asset = membership
    ? readOwnedAsset(input.session, { owner: parseAssetOwnerKey(membership.ownerKey), assetId: input.target.id })
    : null;
  if (!asset) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND', `Media generation target Asset was not found: ${input.target.id}.`);
  }
  const sourceMediaKind = input.purpose === 'video.edit' ? 'video' : 'image';
  const sourceFiles = asset.files.filter((file) => file.mediaKind === sourceMediaKind);
  if (asset.mediaKind !== sourceMediaKind || sourceFiles.length === 0) {
    throw new ProjectDataError(
      input.purpose === 'video.edit'
        ? 'CORE_VIDEO_EDIT_SOURCE_INVALID'
        : 'CORE_IMAGE_EDIT_SOURCE_INVALID',
      `${input.purpose} requires an active ${sourceMediaKind} Asset with a current ${sourceMediaKind} file.`,
    );
  }
  return {
    targetContext: { kind: 'asset', asset },
    visualLanguage: [],
    suggestedReferences: [createReferenceSuggestion({
      id: input.purpose === 'video.edit' ? 'source-video' : 'source-image',
      role: input.purpose === 'video.edit' ? 'source-video' : 'source-image',
      assets: [{ ...asset, files: sourceFiles }],
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    })],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Asset media editing requires an Asset target.');
}
