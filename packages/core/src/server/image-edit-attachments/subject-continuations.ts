import type { AssetFile, AssetFileOwner } from '../../client/asset-files.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  projectCoverCandidateResourceKeys,
  studioAssetFileOwnerSurfaceResourceKeys,
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
  source: AssetFile,
  destination: ProjectAssetFileDestination,
  resourceKeys = studioAssetFileOwnerSurfaceResourceKeys(source.owner),
): ImageEditContinuation {
  return {
    owner: source.owner,
    assetFileType: source.type,
    destination,
    resourceKeys,
  };
}

function requireOwner<K extends AssetFileOwner['kind']>(
  source: AssetFile,
  kind: K,
): Extract<AssetFileOwner, { kind: K }> {
  if (source.owner.kind !== kind) {
    throw ownerInvalid(source);
  }
  return source.owner as Extract<AssetFileOwner, { kind: K }>;
}

function semanticName(source: AssetFile): string {
  return source.referenceName?.trim() || source.title || source.id;
}

function ownerInvalid(source: AssetFile): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_OWNER_INVALID',
    `Asset ${source.id} has ownership that is invalid for ${source.type}.`,
  );
}
