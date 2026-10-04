import type { AssetFileOwner, AssetFileSelectionTarget } from '../../client/asset-files.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetFileOwnerKey } from './owner-keys.js';

export function assetFileSelectionTargetKey(target: AssetFileSelectionTarget): string {
  if (target.kind === 'locationWorld') {
    return `locationWorld:${encodeTargetId(target.id)}`;
  }
  return assetFileOwnerKey(selectionTargetOwner(target));
}

export function selectionTargetOwner(
  target: AssetFileSelectionTarget
): AssetFileOwner {
  if (target.kind === 'project') {
    return { kind: 'project' };
  }
  if (target.kind === 'locationWorld') {
    return { kind: 'location', id: target.id };
  }
  return target.kind === 'sceneBeat'
    ? target
    : { kind: target.kind, id: target.id };
}

export function assetFileSelectionTargetForOwner(
  owner: AssetFileOwner
): AssetFileSelectionTarget | null {
  if (owner.kind === 'sceneBeat') {
    return owner;
  }
  if (
    owner.kind === 'castMember'
    || owner.kind === 'location'
    || owner.kind === 'prop'
    || owner.kind === 'lookbook'
    || owner.kind === 'shot'
  ) {
    return { kind: owner.kind, id: owner.id };
  }
  return null;
}

function encodeTargetId(id: string): string {
  if (!id) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_INVALID',
      'Asset selection target ids cannot be empty.'
    );
  }
  return encodeURIComponent(id);
}
