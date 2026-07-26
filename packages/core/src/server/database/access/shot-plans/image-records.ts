import { eq } from 'drizzle-orm';
import {
  shotRepresentativeDisplayAssets,
} from '../../../schema/index.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export function readShotRepresentativeAssetId(
  session: DatabaseSession,
  shotId: string
): string | null {
  return (
    session.db
      .select({ assetId: shotRepresentativeDisplayAssets.assetId })
      .from(shotRepresentativeDisplayAssets)
      .where(eq(shotRepresentativeDisplayAssets.shotId, shotId))
      .get()?.assetId ?? null
  );
}

export function writeShotRepresentativeAsset(
  session: DatabaseSession,
  input: { shotId: string; assetId: string; now: string }
): void {
  session.db
    .insert(shotRepresentativeDisplayAssets)
    .values({
      shotId: input.shotId,
      assetId: input.assetId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: shotRepresentativeDisplayAssets.shotId,
      set: {
        assetId: input.assetId,
        updatedAt: input.now,
      },
    })
    .run();
}

export function clearShotRepresentativeAsset(
  session: DatabaseSession,
  shotId: string
): void {
  session.db
    .delete(shotRepresentativeDisplayAssets)
    .where(eq(shotRepresentativeDisplayAssets.shotId, shotId))
    .run();
}
