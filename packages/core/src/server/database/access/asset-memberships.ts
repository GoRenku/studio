import { eq } from 'drizzle-orm';
import { assetMemberships } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type AssetMembershipRecord = typeof assetMemberships.$inferSelect;

export function insertAssetMembershipRecord(
  session: DatabaseSession,
  input: {
    assetId: string;
    ownerKey: string;
    now: string;
  }
): void {
  const existing = readAssetMembershipRecord(session, input.assetId);
  if (existing && existing.ownerKey !== input.ownerKey) {
    throw new ProjectDataError(
      'CORE_ASSET_OWNERSHIP_CONFLICT',
      `Asset ${input.assetId} already belongs to another owner.`
    );
  }
  if (!existing) {
    session.db.insert(assetMemberships).values({
      assetId: input.assetId,
      ownerKey: input.ownerKey,
      createdAt: input.now,
      updatedAt: input.now,
    }).run();
  }
}

export function readAssetMembershipRecord(
  session: DatabaseSession,
  assetId: string
): AssetMembershipRecord | null {
  return session.db
    .select()
    .from(assetMemberships)
    .where(eq(assetMemberships.assetId, assetId))
    .get() ?? null;
}
