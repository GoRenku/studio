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
  return {
    targetContext: { kind: 'asset', asset },
    visualLanguage: [],
    suggestedReferences: [createReferenceSuggestion({
      id: 'source-image',
      role: 'source-image',
      assets: [asset],
      projectFolder: input.projectFolder,
      warnings: input.warnings,
    })],
    resourceKeys: [],
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'image.edit requires an Asset target.');
}
