import { and, asc, eq, or, sql } from 'drizzle-orm';
import { castVoiceProviderRegistrations, castVoices } from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type CastVoiceRecord = typeof castVoices.$inferSelect;
export type CastVoiceProviderRegistrationRecord =
  typeof castVoiceProviderRegistrations.$inferSelect;

export interface InsertCastVoiceRecord {
  id: string;
  castMemberId: string;
  name: string;
  purpose: string;
  sampleAssetId: string;
  sampleSourceKind: string;
  sampleId?: string | null;
  sampleFetchedAt?: string | null;
  sampleApiBaseUrl?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertCastVoiceProviderRegistrationRecord {
  id: string;
  castVoiceId: string;
  provider: string;
  registrationModel: string;
  externalVoiceId: string;
  capabilitiesJson: string;
  sourceSampleAssetId?: string | null;
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
    .where(eq(castVoices.castMemberId, castMemberId))
    .orderBy(asc(castVoices.sortOrder), asc(castVoices.name), asc(castVoices.id))
    .all();
}

export function insertCastVoiceProviderRegistrationRecord(
  session: DatabaseSession,
  record: InsertCastVoiceProviderRegistrationRecord
): void {
  session.db.insert(castVoiceProviderRegistrations).values(record).run();
}

export function listCastVoiceProviderRegistrationRecords(
  session: DatabaseSession,
  castVoiceId: string
): CastVoiceProviderRegistrationRecord[] {
  return session.db
    .select()
    .from(castVoiceProviderRegistrations)
    .where(eq(castVoiceProviderRegistrations.castVoiceId, castVoiceId))
    .orderBy(
      asc(castVoiceProviderRegistrations.provider),
      asc(castVoiceProviderRegistrations.registrationModel),
      asc(castVoiceProviderRegistrations.id)
    )
    .all();
}

export function readCastVoiceProviderRegistrationRecord(
  session: DatabaseSession,
  input: { castVoiceId: string; registrationId: string }
): CastVoiceProviderRegistrationRecord | null {
  return (
    session.db
      .select()
      .from(castVoiceProviderRegistrations)
      .where(
        and(
          eq(castVoiceProviderRegistrations.castVoiceId, input.castVoiceId),
          eq(castVoiceProviderRegistrations.id, input.registrationId)
        )
      )
      .get() ?? null
  );
}

export function deleteCastVoiceProviderRegistrationRecords(
  session: DatabaseSession,
  castVoiceId: string
): void {
  session.db
    .delete(castVoiceProviderRegistrations)
    .where(eq(castVoiceProviderRegistrations.castVoiceId, castVoiceId))
    .run();
}

export function deleteCastVoiceProviderRegistrationRecord(
  session: DatabaseSession,
  input: { castVoiceId: string; registrationId: string }
): void {
  session.db
    .delete(castVoiceProviderRegistrations)
    .where(
      and(
        eq(castVoiceProviderRegistrations.castVoiceId, input.castVoiceId),
        eq(castVoiceProviderRegistrations.id, input.registrationId)
      )
    )
    .run();
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
      .where(eq(castVoices.sampleAssetId, sampleAssetId))
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
    .where(eq(castVoices.castMemberId, castMemberId))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function deleteCastVoiceRecord(
  session: DatabaseSession,
  input: { castMemberId: string; voiceId: string }
): void {
  session.db
    .delete(castVoices)
    .where(
      and(
        eq(castVoices.castMemberId, input.castMemberId),
        eq(castVoices.id, input.voiceId)
      )
    )
    .run();
}
