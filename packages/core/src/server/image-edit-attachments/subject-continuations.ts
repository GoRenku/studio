import type { Asset, AssetOwner } from '../../client/assets.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  projectCoverCandidateResourceKeys,
  studioAssetOwnerSurfaceResourceKeys,
} from '../studio-coordination/resource-keys.js';
import type {
  ImageEditContinuation,
  ImageEditContinuationInput,
} from './continuation-registry.js';

export function resolveSubjectImageEditContinuation(
  input: ImageEditContinuationInput,
): ImageEditContinuation | null {
  const { source } = input;
  switch (source.type) {
    case 'project_cover':
      requireOwner(source, 'project');
      return continuation(source, { kind: 'project.cover' }, projectCoverCandidateResourceKeys());
    case 'cast_profile': {
      const owner = requireOwner(source, 'castMember');
      return continuation(source, { kind: 'cast.profile', castMemberId: owner.id });
    }
    case 'character_sheet': {
      const owner = requireOwner(source, 'castMember');
      return continuation(source, {
        kind: 'cast.characterSheet', castMemberId: owner.id, semanticName: semanticName(source),
      });
    }
    case 'location_hero': {
      const owner = requireOwner(source, 'location');
      return continuation(source, { kind: 'location.hero', locationId: owner.id });
    }
    case 'location_sheet': {
      const owner = requireOwner(source, 'location');
      return continuation(source, {
        kind: 'location.sheet', locationId: owner.id, semanticName: semanticName(source),
      });
    }
    case 'prop_hero': {
      const owner = requireOwner(source, 'prop');
      return continuation(source, { kind: 'prop.hero', propId: owner.id });
    }
    case 'prop_sheet': {
      const owner = requireOwner(source, 'prop');
      return continuation(source, {
        kind: 'prop.sheet', propId: owner.id, semanticName: semanticName(source),
      });
    }
    default:
      return null;
  }
}

function continuation(
  source: Asset,
  destination: ProjectAssetFileDestination,
  resourceKeys = studioAssetOwnerSurfaceResourceKeys(source.owner),
): ImageEditContinuation {
  return {
    owner: source.owner,
    assetType: source.type,
    destination,
    fileRole: 'primary',
    resourceKeys,
  };
}

function requireOwner<K extends AssetOwner['kind']>(
  source: Asset,
  kind: K,
): Extract<AssetOwner, { kind: K }> {
  if (source.owner.kind !== kind) {
    throw ownerInvalid(source);
  }
  return source.owner as Extract<AssetOwner, { kind: K }>;
}

function semanticName(source: Asset): string {
  return source.referenceName?.trim() || source.title;
}

function ownerInvalid(source: Asset): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_OWNER_INVALID',
    `Asset ${source.id} has ownership that is invalid for ${source.type}.`,
  );
}
