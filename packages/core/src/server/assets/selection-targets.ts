import type { AssetOwner, AssetSelectionTarget } from '../../client/assets.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetOwnerKey } from './owner-keys.js';

export function assetSelectionTargetKey(target: AssetSelectionTarget): string {
  if (target.kind === 'locationWorld') {
    return `locationWorld:${encodeTargetId(target.id)}`;
  }
  return assetOwnerKey(selectionTargetOwner(target));
}

export function selectionTargetOwner(
  target: AssetSelectionTarget
): AssetOwner {
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

export function assetSelectionTargetForOwner(
  owner: AssetOwner
): AssetSelectionTarget | null {
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
