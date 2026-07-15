import { eq } from 'drizzle-orm';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  castProfileDisplayAssets,
  locationHeroDisplayAssets,
} from '../../schema/index.js';

export function readCastProfileDisplayAssetId(
  session: DatabaseSession,
  castMemberId: string
): string | null {
  return session.db.select({ assetId: castProfileDisplayAssets.assetId })
    .from(castProfileDisplayAssets)
    .where(eq(castProfileDisplayAssets.castMemberId, castMemberId))
    .get()?.assetId ?? null;
}

export function writeCastProfileDisplayAsset(input: {
  session: DatabaseSession;
  castMemberId: string;
  assetId: string;
  now: string;
}): void {
  input.session.db.insert(castProfileDisplayAssets).values({
    castMemberId: input.castMemberId,
    assetId: input.assetId,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoUpdate({
    target: castProfileDisplayAssets.castMemberId,
    set: { assetId: input.assetId, updatedAt: input.now },
  }).run();
}

export function clearCastProfileDisplayAssetRecord(
  session: DatabaseSession,
  castMemberId: string
): void {
  session.db.delete(castProfileDisplayAssets)
    .where(eq(castProfileDisplayAssets.castMemberId, castMemberId)).run();
}

export function readLocationHeroDisplayAssetId(
  session: DatabaseSession,
  locationId: string
): string | null {
  return session.db.select({ assetId: locationHeroDisplayAssets.assetId })
    .from(locationHeroDisplayAssets)
    .where(eq(locationHeroDisplayAssets.locationId, locationId))
    .get()?.assetId ?? null;
}

export function writeLocationHeroDisplayAsset(input: {
  session: DatabaseSession;
  locationId: string;
  assetId: string;
  now: string;
}): void {
  input.session.db.insert(locationHeroDisplayAssets).values({
    locationId: input.locationId,
    assetId: input.assetId,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoUpdate({
    target: locationHeroDisplayAssets.locationId,
    set: { assetId: input.assetId, updatedAt: input.now },
  }).run();
}

export function clearLocationHeroDisplayAssetRecord(
  session: DatabaseSession,
  locationId: string
): void {
  session.db.delete(locationHeroDisplayAssets)
    .where(eq(locationHeroDisplayAssets.locationId, locationId)).run();
}
