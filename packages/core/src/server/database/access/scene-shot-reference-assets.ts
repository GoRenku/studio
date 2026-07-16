import { and, desc, eq, isNull } from 'drizzle-orm';
import { sceneShotReferenceAssets } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type SceneShotReferenceAssetRecord =
  typeof sceneShotReferenceAssets.$inferSelect;

export function readSceneShotReferenceAssetForSlot(input: {
  session: DatabaseSession;
  shotListId: string;
  shotId: string;
  assetFileId: string;
}): SceneShotReferenceAssetRecord | null {
  return input.session.db.select()
    .from(sceneShotReferenceAssets)
    .where(and(
      eq(sceneShotReferenceAssets.shotListId, input.shotListId),
      eq(sceneShotReferenceAssets.shotId, input.shotId),
      eq(sceneShotReferenceAssets.assetFileId, input.assetFileId)
    )).get() ?? null;
}

export function nextSceneShotReferenceAssetSortOrder(input: {
  session: DatabaseSession;
  shotListId: string;
  shotId: string;
}): number {
  const previous = input.session.db
    .select({ sortOrder: sceneShotReferenceAssets.sortOrder })
    .from(sceneShotReferenceAssets)
    .where(and(
      eq(sceneShotReferenceAssets.shotListId, input.shotListId),
      eq(sceneShotReferenceAssets.shotId, input.shotId),
      isNull(sceneShotReferenceAssets.discardedAt)
    ))
    .orderBy(desc(sceneShotReferenceAssets.sortOrder))
    .get();
  return (previous?.sortOrder ?? -1) + 1;
}

export function createSceneShotReferenceAssetRecord(input: {
  session: DatabaseSession;
  id: string;
  sceneId: string;
  shotListId: string;
  shotId: string;
  assetId: string;
  assetFileId: string;
  sortOrder: number;
  now: string;
}): void {
  input.session.db.insert(sceneShotReferenceAssets).values({
    id: input.id,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    shotId: input.shotId,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    sortOrder: input.sortOrder,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function countActiveSceneShotReferenceAssetOwners(
  session: DatabaseSession,
  assetId: string
): number {
  return session.db
    .select({ id: sceneShotReferenceAssets.id })
    .from(sceneShotReferenceAssets)
    .where(and(
      eq(sceneShotReferenceAssets.assetId, assetId),
      isNull(sceneShotReferenceAssets.discardedAt)
    ))
    .all().length;
}
