import type {
  MediaGenerationDependencySlot,
} from '../../client/index.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ResolvedMediaGenerationDependencyAsset } from './dependency-graph.js';
import { listLookbookSheets } from '../database/access/lookbook-sheets.js';

export function resolveExistingDependencyAsset(input: {
  session: DatabaseSession;
  slot: MediaGenerationDependencySlot;
}): ResolvedMediaGenerationDependencyAsset | null {
  if (input.slot.dependencyKind === 'cast-character-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'castMember') {
      return null;
    }
    return firstImageAssetForTarget(input.session, {
      target: {
        kind: 'castMember',
        castMemberId: input.slot.dependencyTarget.id,
      },
      role: 'character_sheet',
    });
  }
  if (input.slot.dependencyKind === 'location-environment-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'location') {
      return null;
    }
    return firstImageAssetForTarget(input.session, {
      target: {
        kind: 'location',
        locationId: input.slot.dependencyTarget.id,
      },
      role: 'environment_sheet',
    });
  }
  if (input.slot.dependencyKind === 'lookbook-sheet') {
    if (input.slot.dependencyTarget?.kind !== 'lookbook') {
      return null;
    }
    const sheet = listLookbookSheets(input.session, input.slot.dependencyTarget.id)[0];
    const file = sheet?.asset.files.find((candidate) => candidate.mediaKind === 'image');
    return sheet && file
      ? {
          assetId: sheet.asset.assetId,
          assetFileId: file.id,
        }
      : null;
  }
  return null;
}

function firstImageAssetForTarget(
  session: DatabaseSession,
  input: {
    target: Parameters<typeof listAssetRelationshipPage>[1]['target'];
    role: string;
  }
): ResolvedMediaGenerationDependencyAsset | null {
  const asset = listAssetRelationshipPage(session, {
    target: input.target,
    role: input.role,
    mediaKind: 'image',
    limit: MAX_RESOURCE_PAGE_LIMIT,
  }).items[0];
  const file = asset?.files.find((candidate) => candidate.mediaKind === 'image');
  return asset && file
    ? {
        assetId: asset.assetId,
        assetFileId: file.id,
      }
    : null;
}
