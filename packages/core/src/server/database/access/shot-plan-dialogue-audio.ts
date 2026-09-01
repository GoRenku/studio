import { and, asc, eq, isNull } from 'drizzle-orm';
import { shotPlanDialogueAudioTakes } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type ShotPlanDialogueAudioTakeRecord = typeof shotPlanDialogueAudioTakes.$inferSelect;

export function insertShotPlanDialogueAudioTakeRecord(
  session: DatabaseSession,
  record: typeof shotPlanDialogueAudioTakes.$inferInsert,
): void {
  session.db.insert(shotPlanDialogueAudioTakes).values(record).run();
}

export function listShotPlanDialogueAudioTakeRecords(
  session: DatabaseSession,
  shotPlanId: string,
): ShotPlanDialogueAudioTakeRecord[] {
  return session.db
    .select()
    .from(shotPlanDialogueAudioTakes)
    .where(and(
      eq(shotPlanDialogueAudioTakes.shotPlanId, shotPlanId),
      isNull(shotPlanDialogueAudioTakes.discardedAt),
    ))
    .orderBy(asc(shotPlanDialogueAudioTakes.createdAt), asc(shotPlanDialogueAudioTakes.id))
    .all();
}

export function readShotPlanDialogueAudioTakeRecord(
  session: DatabaseSession,
  input: { shotPlanId: string; takeId: string },
): ShotPlanDialogueAudioTakeRecord | null {
  return session.db
    .select()
    .from(shotPlanDialogueAudioTakes)
    .where(and(
      eq(shotPlanDialogueAudioTakes.shotPlanId, input.shotPlanId),
      eq(shotPlanDialogueAudioTakes.id, input.takeId),
      isNull(shotPlanDialogueAudioTakes.discardedAt),
    ))
    .get() ?? null;
}

export function readShotPlanDialogueAudioTakeByAssetId(
  session: DatabaseSession,
  assetId: string,
): ShotPlanDialogueAudioTakeRecord | null {
  return session.db
    .select()
    .from(shotPlanDialogueAudioTakes)
    .where(and(
      eq(shotPlanDialogueAudioTakes.assetId, assetId),
      isNull(shotPlanDialogueAudioTakes.discardedAt),
    ))
    .get() ?? null;
}

export function setShotPlanDialogueAudioTakeSelectedAt(
  session: DatabaseSession,
  input: { takeId: string; selectedAt: string | null; updatedAt: string },
): void {
  session.db
    .update(shotPlanDialogueAudioTakes)
    .set({ selectedAt: input.selectedAt, updatedAt: input.updatedAt })
    .where(eq(shotPlanDialogueAudioTakes.id, input.takeId))
    .run();
}
