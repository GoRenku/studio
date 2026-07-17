import type { AssetTarget } from '../../client/assets.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import {
  studioCastMemberSurfaceResourceKey,
  studioLocationSurfaceResourceKey,
  studioVisualLanguageLookbookResourceKey,
} from '../studio-coordination/resource-keys.js';

export interface GeneratedMediaAttachmentDestination {
  file: ProjectAssetFileDestination;
  target: AssetTarget;
  lookbookMembership?: {
    kind: 'image' | 'sheet';
    lookbookId: string;
  };
  resourceKeys: string[];
}

export function castCharacterSheetAttachmentDestination(
  castMemberId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.characterSheet', castMemberId, titleHint },
    target: { kind: 'castMember', castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function castProfileAttachmentDestination(
  castMemberId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'cast.profile', castMemberId, titleHint },
    target: { kind: 'castMember', castMemberId },
    resourceKeys: [studioCastMemberSurfaceResourceKey(castMemberId)],
  };
}

export function locationSheetAttachmentDestination(
  locationId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.environmentSheet', locationId, titleHint },
    target: { kind: 'location', locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function locationHeroAttachmentDestination(
  locationId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'location.hero', locationId, heroName: titleHint },
    target: { kind: 'location', locationId },
    resourceKeys: [studioLocationSurfaceResourceKey(locationId)],
  };
}

export function lookbookImageAttachmentDestination(
  lookbookId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookImage', titleHint },
    target: { kind: 'project' },
    lookbookMembership: { kind: 'image', lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}

export function lookbookSheetAttachmentDestination(
  lookbookId: string,
  titleHint?: string
): GeneratedMediaAttachmentDestination {
  return {
    file: { kind: 'visualLanguage.lookbookSheet', titleHint },
    target: { kind: 'project' },
    lookbookMembership: { kind: 'sheet', lookbookId },
    resourceKeys: [studioVisualLanguageLookbookResourceKey(lookbookId)],
  };
}
