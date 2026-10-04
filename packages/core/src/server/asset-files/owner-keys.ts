import type { AssetFileOwner } from '../../client/asset-files.js';
import { ProjectDataError } from '../project-data-error.js';

export function assetFileOwnerKey(owner: AssetFileOwner): string {
  switch (owner.kind) {
    case 'project':
      return 'project';
    case 'sceneBeat':
      return `sceneBeat:${encodeOwnerId(owner.sceneId)}:${encodeOwnerId(owner.beatId)}`;
    default:
      return `${owner.kind}:${encodeOwnerId(owner.id)}`;
  }
}

export function parseAssetFileOwnerKey(ownerKey: string): AssetFileOwner {
  if (ownerKey === 'project') {
    return { kind: 'project' };
  }
  const parts = ownerKey.split(':');
  try {
    if (parts[0] === 'sceneBeat' && parts.length === 3) {
      return {
        kind: 'sceneBeat',
        sceneId: decodeOwnerId(parts[1]!),
        beatId: decodeOwnerId(parts[2]!),
      };
    }
    if (parts.length === 2 && isSingleIdOwnerKind(parts[0])) {
      return { kind: parts[0], id: decodeOwnerId(parts[1]!) };
    }
  } catch {
    throw invalidOwnerKey(ownerKey);
  }
  throw invalidOwnerKey(ownerKey);
}

function encodeOwnerId(id: string): string {
  if (!id) {
    throw new ProjectDataError(
      'CORE_ASSET_OWNER_INVALID',
      'Asset owner ids cannot be empty.'
    );
  }
  return encodeURIComponent(id);
}

function decodeOwnerId(value: string): string {
  const id = decodeURIComponent(value);
  if (!id) {
    throw new Error('empty owner id');
  }
  return id;
}

function isSingleIdOwnerKind(
  value: string | undefined
): value is Exclude<AssetFileOwner['kind'], 'project' | 'sceneBeat'> {
  return value === 'castMember'
    || value === 'location'
    || value === 'prop'
    || value === 'scene'
    || value === 'lookbook'
    || value === 'shot'
    || value === 'inspirationFolder';
}

function invalidOwnerKey(ownerKey: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_ASSET_STORAGE_INVALID',
    `Stored Asset owner key is invalid: ${ownerKey}.`
  );
}
