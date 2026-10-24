import type { AssetFileOwner, AssetFileSelectionTarget } from '../../client/asset-files.js';
import { readCastCostumeRecord } from '../database/access/casting/costumes.js';
import { readCastLookRecord } from '../database/access/casting/looks.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { assetFileOwnerKey } from './owner-keys.js';

type ScopedSelectionTarget = Extract<AssetFileSelectionTarget, { kind: 'locationWorld' | 'castLook' | 'castCostume' }>;

export function assetFileSelectionTargetKey(target: AssetFileSelectionTarget): string {
  if (isScopedSelectionTarget(target)) {
    return `${target.kind}:${encodeTargetId(target.id)}`;
  }
  return assetFileOwnerKey(target.kind === 'project' || target.kind === 'sceneBeat' ? target : { kind: target.kind, id: target.id });
}

type CastingSelectionTarget = Extract<AssetFileSelectionTarget, { kind: 'castLook' | 'castCostume' }>;

/** The Asset owner whose files an owner-scoped selection target may select. */
export function selectionTargetOwner(
  target: Exclude<AssetFileSelectionTarget, CastingSelectionTarget>
): AssetFileOwner {
  if (target.kind === 'project' || target.kind === 'sceneBeat') {
    return target;
  }
  if (target.kind === 'locationWorld') {
    return { kind: 'location', id: target.id };
  }
  return { kind: target.kind, id: target.id };
}

/** The Asset owner of any selection target; Looks and costumes resolve to their Cast Member. */
export function resolveSelectionTargetOwner(
  session: DatabaseSession,
  target: AssetFileSelectionTarget
): AssetFileOwner {
  if (target.kind === 'castLook') {
    const look = readCastLookRecord(session, target.id);
    if (!look) {
      throw new ProjectDataError('CASTING_LOOK_NOT_FOUND', `Cast Look was not found: ${target.id}.`, {
        suggestion: 'List the Looks with `renku cast looks show --cast <cast-member-id>`.',
      });
    }
    return { kind: 'castMember', id: look.castMemberId };
  }
  if (target.kind === 'castCostume') {
    const costume = readCastCostumeRecord(session, target.id);
    if (!costume) {
      throw new ProjectDataError('CASTING_COSTUME_NOT_FOUND', `Cast Costume was not found: ${target.id}.`, {
        suggestion: 'List the costumes with `renku cast wardrobe show --cast <cast-member-id>`.',
      });
    }
    return { kind: 'castMember', id: costume.castMemberId };
  }
  return selectionTargetOwner(target);
}

function isScopedSelectionTarget(target: AssetFileSelectionTarget): target is ScopedSelectionTarget {
  return target.kind === 'locationWorld' || target.kind === 'castLook' || target.kind === 'castCostume';
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
