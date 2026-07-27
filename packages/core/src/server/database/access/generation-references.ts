import { eq } from 'drizzle-orm';
import {
  assetFileGenerations,
  assetMemberships,
} from '../../schema/index.js';
import { listAssetFileRecords, readAssetFileRecord } from './asset-files.js';
import { listAssetRecords, readAssetRecord } from './assets.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import type { AssetOwner } from '../../../client/assets.js';
import { parseAssetOwnerKey } from '../../assets/owner-keys.js';

export interface GenerationReferenceAssetFileRecord {
  asset: NonNullable<ReturnType<typeof readAssetRecord>>;
  file: NonNullable<ReturnType<typeof readAssetFileRecord>>;
  owner: AssetOwner | null;
  generationRunId: string | null;
}

export function listGenerationReferenceAssetFileRecords(
  session: DatabaseSession
): GenerationReferenceAssetFileRecord[] {
  const assets = new Map(
    listAssetRecords(session)
      .filter((asset) => asset.availability === 'ready')
      .map((asset) => [asset.id, asset])
  );
  const owners = readAssetOwners(session);
  const provenance = new Map(
    session.db
      .select()
      .from(assetFileGenerations)
      .all()
      .map((record) => [record.assetFileId, record.mediaGenerationRunId])
  );
  return listAssetFileRecords(session).flatMap((file) => {
    const asset = assets.get(file.assetId);
    return asset
      ? [{
          asset,
          file,
          owner: owners.get(file.assetId) ?? null,
          generationRunId: provenance.get(file.id) ?? null,
        }]
      : [];
  });
}

export function readGenerationReferenceAssetFileRecord(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): GenerationReferenceAssetFileRecord | null {
  const asset = readAssetRecord(session, input.assetId);
  const file = readAssetFileRecord(session, input);
  if (!asset || asset.discardedAt || asset.availability !== 'ready' || !file) {
    return null;
  }
  const generation = session.db
    .select()
    .from(assetFileGenerations)
    .where(eq(assetFileGenerations.assetFileId, file.id))
    .get();
  return {
    asset,
    file,
    owner: readAssetOwners(session).get(asset.id) ?? null,
    generationRunId: generation?.mediaGenerationRunId ?? null,
  };
}

function readAssetOwners(session: DatabaseSession): Map<
  string,
  AssetOwner
> {
  return new Map(
    session.db.select().from(assetMemberships).all()
      .map((membership) => [
        membership.assetId,
        parseAssetOwnerKey(membership.ownerKey),
      ])
  );
}
