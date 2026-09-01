import type { CastVoice, CastVoiceListReport, CastVoiceReadReport } from '../../client/cast-voices.js';
import { readOwnedAsset } from '../assets/projection.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import {
  listCastVoiceRecords,
  readCastVoiceDefaultRecord,
  readCastVoiceRecord,
  type CastVoiceRecord,
} from '../database/access/cast-voices.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { withCastVoiceProjectSession, type CastVoiceProjectInput } from './project-session.js';

export interface CastVoiceTargetInput extends CastVoiceProjectInput {
  castMemberId: string;
}

export interface CastVoiceLookupInput extends CastVoiceTargetInput {
  voiceIdOrName: string;
}

export async function listCastVoices(
  input: CastVoiceTargetInput
): Promise<CastVoiceListReport> {
  return withCastVoiceProjectSession(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    return { voices: listCastVoicesInSession(session, input.castMemberId) };
  });
}

export async function readCastVoice(
  input: CastVoiceLookupInput
): Promise<CastVoiceReadReport> {
  return withCastVoiceProjectSession(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    return { voice: toCastVoice(session, requireCastVoiceRecord(session, input)) };
  });
}

export function listCastVoicesInSession(
  session: DatabaseSession,
  castMemberId: string,
): CastVoice[] {
  return listCastVoiceRecords(session, castMemberId).map((record) => toCastVoice(session, record));
}

export function toCastVoice(session: DatabaseSession, record: CastVoiceRecord): CastVoice {
  const sample = readOwnedAsset(session, {
    owner: { kind: 'castMember', id: record.castMemberId },
    assetId: record.sampleAssetId,
  });
  if (!sample) {
    throw new ProjectDataError(
      'PROJECT_DATA352',
      `Cast Voice sample asset is missing: ${record.sampleAssetId}.`
    );
  }
  return {
    id: record.id,
    castMemberId: record.castMemberId,
    name: record.name,
    purpose: record.purpose,
    isDefault: readCastVoiceDefaultRecord(session, record.castMemberId)?.castVoiceId === record.id,
    voiceIdentity: record.voiceIdentity ?? null,
    sample: {
      ...sample,
      files: sample.files.filter((file) => file.mediaKind === 'audio'),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function requireCastMember(session: DatabaseSession, castMemberId: string) {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw new ProjectDataError('PROJECT_DATA340', `Cast member was not found: ${castMemberId}.`);
  }
  return castMember;
}

export function requireCastVoiceRecord(
  session: DatabaseSession,
  input: { castMemberId: string; voiceIdOrName: string }
): CastVoiceRecord {
  const record = readCastVoiceRecord(session, input);
  if (!record) {
    throw new ProjectDataError(
      'PROJECT_DATA350',
      `Cast Voice was not found for Cast Member ${input.castMemberId}: ${input.voiceIdOrName}.`
    );
  }
  return record;
}
