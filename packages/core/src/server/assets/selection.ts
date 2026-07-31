import type {
  AssetOwner,
  AssetSelectionReport,
  AssetSelectionTarget,
  ClearAssetSelectionInput,
  SelectAssetInput,
} from '../../client/assets.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import { clearSelectedAssetRecord, writeSelectedAssetRecord } from '../database/access/selected-assets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { assetOwnerResourceKeys } from './resource-keys.js';
import { assetOwnerKey } from './owner-keys.js';
import { assertAssetOwnerExists } from './ownership.js';

const selectedAssetTypes: Record<AssetSelectionTarget['kind'], string> = {
  castMember: 'cast_profile',
  location: 'location_hero',
  prop: 'prop_hero',
  lookbook: 'lookbook_image',
  shot: 'shot_image',
  sceneBeat: 'scene_storyboard_image',
};

export async function selectAsset(
  input: SelectAssetInput & RenkuConfigPathOptions
): Promise<AssetSelectionReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = selectionTargetOwner(input.target);
    assertSelectionInSession(session, {
      target: input.target,
      owner,
      assetId: input.assetId,
    });
    writeSelectedAssetRecord(session, {
      ownerKey: assetOwnerKey(owner),
      assetId: input.assetId,
      now: new Date().toISOString(),
    });
    return selectionReport(session, projectFolder, input.target, input.assetId);
  } finally {
    session.close();
  }
}

export async function clearAssetSelection(
  input: ClearAssetSelectionInput & RenkuConfigPathOptions
): Promise<AssetSelectionReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const owner = selectionTargetOwner(input.target);
    assertAssetOwnerExists(session, owner);
    clearSelectedAssetRecord(session, assetOwnerKey(owner));
    return selectionReport(session, projectFolder, input.target, null);
  } finally {
    session.close();
  }
}

export function selectAssetInSession(
  session: DatabaseSession,
  input: { target: AssetSelectionTarget; assetId: string; now: string }
): void {
  const owner = selectionTargetOwner(input.target);
  assertSelectionInSession(session, { ...input, owner });
  writeSelectedAssetRecord(session, {
    ownerKey: assetOwnerKey(owner),
    assetId: input.assetId,
    now: input.now,
  });
}

export function assetSelectionTargetForOwnerType(
  owner: AssetOwner,
  assetType: string
): AssetSelectionTarget {
  const target = owner.kind === 'sceneBeat'
    ? owner
    : owner.kind === 'castMember'
      || owner.kind === 'location'
      || owner.kind === 'prop'
      || owner.kind === 'lookbook'
      || owner.kind === 'shot'
      ? { kind: owner.kind, id: owner.id }
      : null;
  if (!target || selectedAssetTypes[target.kind] !== assetType) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_UNSUPPORTED',
      `Asset type ${assetType} does not support canonical selection for ${owner.kind}.`
    );
  }
  return target;
}

export function selectionTargetOwner(
  target: AssetSelectionTarget
): AssetOwner {
  return target.kind === 'sceneBeat'
    ? target
    : { kind: target.kind, id: target.id };
}

function assertSelectionInSession(
  session: DatabaseSession,
  input: {
    target: AssetSelectionTarget;
    owner: AssetOwner;
    assetId: string;
  }
): void {
  assertAssetOwnerExists(session, input.owner);
  const asset = readAssetRecord(session, input.assetId);
  const membership = readAssetMembershipRecord(session, input.assetId);
  if (
    !asset
    || asset.discardedAt
    || asset.availability !== 'ready'
    || asset.type !== selectedAssetTypes[input.target.kind]
    || membership?.ownerKey !== assetOwnerKey(input.owner)
  ) {
    throw new ProjectDataError(
      'CORE_ASSET_SELECTION_INVALID',
      'Selected Asset must be an active canonical candidate owned by the exact selection target.'
    );
  }
}

function selectionReport(
  session: DatabaseSession,
  projectFolder: string,
  target: AssetSelectionTarget,
  selectedAssetId: string | null
): AssetSelectionReport {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return {
    valid: true,
    warnings: [],
    project: { id: project.id, name: project.name, projectFolder },
    target,
    selectedAssetId,
    resourceKeys: assetOwnerResourceKeys(
      session,
      selectionTargetOwner(target)
    ),
  };
}
