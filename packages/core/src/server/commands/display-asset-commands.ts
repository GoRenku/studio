import type { Asset } from '../../client/assets.js';
import {
  clearCastProfileDisplayAssetRecord,
  clearLocationHeroDisplayAssetRecord,
  writeCastProfileDisplayAsset,
  writeLocationHeroDisplayAsset,
} from '../database/access/display-assets.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

interface DisplayAssetInput extends RenkuConfigPathOptions {
  projectName: string;
  assetId: string;
}

export async function setCastProfileDisplayAsset(
  input: DisplayAssetInput & { castMemberId: string }
): Promise<Asset> {
  const { session } = await openProjectSession(input);
  try {
    const asset = requireDisplayAsset(session, {
      target: { kind: 'castMember', castMemberId: input.castMemberId },
      assetId: input.assetId,
      role: 'profile',
    });
    writeCastProfileDisplayAsset({
      session,
      castMemberId: input.castMemberId,
      assetId: input.assetId,
      now: new Date().toISOString(),
    });
    return asset;
  } finally {
    session.close();
  }
}

export async function clearCastProfileDisplayAsset(
  input: Omit<DisplayAssetInput, 'assetId'> & { castMemberId: string }
): Promise<void> {
  const { session } = await openProjectSession(input);
  try {
    clearCastProfileDisplayAssetRecord(session, input.castMemberId);
  } finally {
    session.close();
  }
}

export async function setLocationHeroDisplayAsset(
  input: DisplayAssetInput & { locationId: string }
): Promise<Asset> {
  const { session } = await openProjectSession(input);
  try {
    const asset = requireDisplayAsset(session, {
      target: { kind: 'location', locationId: input.locationId },
      assetId: input.assetId,
      role: 'hero',
    });
    writeLocationHeroDisplayAsset({
      session,
      locationId: input.locationId,
      assetId: input.assetId,
      now: new Date().toISOString(),
    });
    return asset;
  } finally {
    session.close();
  }
}

export async function clearLocationHeroDisplayAsset(
  input: Omit<DisplayAssetInput, 'assetId'> & { locationId: string }
): Promise<void> {
  const { session } = await openProjectSession(input);
  try {
    clearLocationHeroDisplayAssetRecord(session, input.locationId);
  } finally {
    session.close();
  }
}

function requireDisplayAsset(
  session: Parameters<typeof readAssetRelationship>[0],
  input: Parameters<typeof readAssetRelationship>[1] & { role: 'profile' | 'hero' }
): Asset {
  const asset = readAssetRelationship(session, input);
  if (!asset || asset.availability !== 'ready' || asset.role !== input.role) {
    throw new ProjectDataError(
      'CORE_DISPLAY_ASSET_INVALID',
      `Display asset must be a current ready ${input.role} attached to the exact owner.`
    );
  }
  return asset;
}
