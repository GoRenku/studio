import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { castVoiceDefaults, castVoices } from '../../schema/index.js';
import type { JsonValue } from '../../../client/json.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type CastVoiceRecord = typeof castVoices.$inferSelect;
export type CastVoiceDefaultRecord = typeof castVoiceDefaults.$inferSelect;

export interface InsertCastVoiceRecord {
  id: string;
  castMemberId: string;
  name: string;
  purpose: string;
  sampleAssetId: string;
  voiceIdentity?: JsonValue | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertCastVoiceRecord(
  session: DatabaseSession,
  record: InsertCastVoiceRecord
): void {
  session.db.insert(castVoices).values(record).run();
}

export function listCastVoiceRecords(
  session: DatabaseSession,
  castMemberId: string
): CastVoiceRecord[] {
  return session.db
    .select()
    .from(castVoices)
    .where(and(eq(castVoices.castMemberId, castMemberId), isNull(castVoices.discardedAt)))
    .orderBy(asc(castVoices.sortOrder), asc(castVoices.name), asc(castVoices.id))
    .all();
}

export function readCastVoiceRecord(
  session: DatabaseSession,
  input: { castMemberId: string; voiceIdOrName: string }
): CastVoiceRecord | null {
  return (
    session.db
      .select()
      .from(castVoices)
      .where(
        and(
          eq(castVoices.castMemberId, input.castMemberId),
          isNull(castVoices.discardedAt),
          or(
            eq(castVoices.id, input.voiceIdOrName),
            eq(castVoices.name, input.voiceIdOrName)
          )
        )
      )
      .get() ?? null
  );
}

export function readCastVoiceRecordBySampleAssetId(
  session: DatabaseSession,
  sampleAssetId: string
): CastVoiceRecord | null {
  return (
    session.db
      .select()
      .from(castVoices)
      .where(and(eq(castVoices.sampleAssetId, sampleAssetId), isNull(castVoices.discardedAt)))
      .get() ?? null
  );
}

export function castVoiceNameExists(
  session: DatabaseSession,
  input: { castMemberId: string; name: string }
): boolean {
  const row = session.db
    .select({ id: castVoices.id })
    .from(castVoices)
    .where(
      and(
        eq(castVoices.castMemberId, input.castMemberId),
        isNull(castVoices.discardedAt),
        eq(castVoices.name, input.name)
      )
    )
    .get();
  return Boolean(row);
}

export function nextCastVoiceSortOrder(
  session: DatabaseSession,
  castMemberId: string
): number {
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${castVoices.sortOrder})` })
    .from(castVoices)
    .where(and(eq(castVoices.castMemberId, castMemberId), isNull(castVoices.discardedAt)))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function readCastVoiceDefaultRecord(
  session: DatabaseSession,
  castMemberId: string
): CastVoiceDefaultRecord | null {
  return session.db
    .select()
    .from(castVoiceDefaults)
    .where(eq(castVoiceDefaults.castMemberId, castMemberId))
    .get() ?? null;
}

export function selectCastVoiceDefaultRecord(
  session: DatabaseSession,
  input: { castMemberId: string; castVoiceId: string; now: string }
): void {
  session.db
    .insert(castVoiceDefaults)
    .values({
      castMemberId: input.castMemberId,
      castVoiceId: input.castVoiceId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: castVoiceDefaults.castMemberId,
      set: { castVoiceId: input.castVoiceId, updatedAt: input.now },
    })
    .run();
}

export function clearCastVoiceDefaultRecord(
  session: DatabaseSession,
  input: { castMemberId: string; castVoiceId?: string }
): void {
  session.db
    .delete(castVoiceDefaults)
    .where(
      input.castVoiceId
        ? and(
            eq(castVoiceDefaults.castMemberId, input.castMemberId),
            eq(castVoiceDefaults.castVoiceId, input.castVoiceId),
          )
        : eq(castVoiceDefaults.castMemberId, input.castMemberId)
    )
    .run();
}
