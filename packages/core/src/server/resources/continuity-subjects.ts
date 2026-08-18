import type {
  Asset,
  AssetOwner,
  CastMemberResource,
  CastOverviewResource,
  CastVoiceProviderCapability,
  CastVoiceProviderRegistration,
  LocationOverviewResource,
  LocationResource,
  PropOverviewResource,
  PropResource,
  ScreenplayImageReference,
} from '../../client/index.js';
import { listAssetPageInSession, readOwnedAsset } from '../assets/projection.js';
import {
  listCastVoiceProviderRegistrationRecords,
  listCastVoiceRecords,
  type CastVoiceProviderRegistrationRecord,
} from '../database/access/cast-voices.js';
import {
  listCastNavigationPage,
  listLocationNavigationPage,
  listPropNavigationPage,
} from '../database/access/navigation.js';
import { readPropRecord } from '../database/access/props.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  ListNavigationInput,
  ReadCastMemberResourceInput,
  ReadLocationResourceInput,
  ReadPropResourceInput,
} from '../project-data-service-contracts.js';
import { readSelectedLocationWorldInSession } from '../location-worlds/assets.js';

export async function readCastOverviewResource(
  input: ListNavigationInput
): Promise<CastOverviewResource> {
  const { session } = await openProjectSession(input);
  try {
    const page = listCastNavigationPage(session, input);
    return {
      cast: {
        ...page,
        items: page.items.map((castMember) => ({
          ...castMember,
          firstImage: firstImageForContinuitySubject(session, {
            kind: 'castMember',
            id: castMember.id,
          }),
        })),
      },
    };
  } finally {
    session.close();
  }
}

export async function readCastMemberResource(
  input: ReadCastMemberResourceInput
): Promise<CastMemberResource> {
  const { session } = await openProjectSession(input);
  try {
    return {
      castMember: requireCastMember(session, input.castMemberId),
      firstImage: firstImageForContinuitySubject(session, {
        kind: 'castMember',
        id: input.castMemberId,
      }),
      voices: listCastVoiceRecords(session, input.castMemberId).map((voice) => {
        const sample = readOwnedAsset(session, {
          owner: { kind: 'castMember', id: input.castMemberId },
          assetId: voice.sampleAssetId,
        });
        if (!sample) {
          throw new ProjectDataError(
            'PROJECT_DATA352',
            `Cast Voice sample asset is missing: ${voice.sampleAssetId}.`
          );
        }
        return {
          id: voice.id,
          castMemberId: voice.castMemberId,
          name: voice.name,
          purpose: voice.purpose,
          providerRegistrations: listCastVoiceProviderRegistrationRecords(
            session,
            voice.id
          ).map(toCastVoiceProviderRegistration),
          sampleSource: castVoiceSampleSource(voice),
          sample: {
            ...sample,
            files: sample.files.filter((file) => file.mediaKind === 'audio'),
          },
          createdAt: voice.createdAt,
          updatedAt: voice.updatedAt,
        };
      }),
    };
  } finally {
    session.close();
  }
}

export async function readLocationOverviewResource(
  input: ListNavigationInput
): Promise<LocationOverviewResource> {
  const { session } = await openProjectSession(input);
  try {
    const page = listLocationNavigationPage(session, input);
    return {
      locations: {
        ...page,
        items: page.items.map((location) => ({
          ...location,
          firstImage: firstImageForContinuitySubject(session, {
            kind: 'location',
            id: location.id,
          }),
        })),
      },
    };
  } finally {
    session.close();
  }
}

export async function readLocationResource(
  input: ReadLocationResourceInput
): Promise<LocationResource> {
  const { session } = await openProjectSession(input);
  try {
    return {
      location: requireLocation(session, input.locationId),
      firstImage: firstImageForContinuitySubject(session, {
        kind: 'location',
        id: input.locationId,
      }),
      selectedWorld: readSelectedLocationWorldInSession(
        session,
        input.locationId
      ),
    };
  } finally {
    session.close();
  }
}

export async function readPropOverviewResource(
  input: ListNavigationInput
): Promise<PropOverviewResource> {
  const { session } = await openProjectSession(input);
  try {
    const page = listPropNavigationPage(session, input);
    return {
      props: {
        ...page,
        items: page.items.map((prop) => ({
          ...prop,
          firstImage: firstImageForContinuitySubject(session, {
            kind: 'prop',
            id: prop.id,
          }),
        })),
      },
    };
  } finally {
    session.close();
  }
}

export async function readPropResource(
  input: ReadPropResourceInput
): Promise<PropResource> {
  const { session } = await openProjectSession(input);
  try {
    const prop = readPropRecord(session, input.propId);
    if (!prop) {
      throwNotFound('Prop', input.propId);
    }
    return {
      prop: {
        id: prop.id,
        handle: prop.handle,
        name: prop.name,
        description: prop.description ?? undefined,
        visualNotes: prop.visualNotes ?? undefined,
      },
      firstImage: firstImageForContinuitySubject(session, {
        kind: 'prop',
        id: input.propId,
      }),
    };
  } finally {
    session.close();
  }
}

export function firstImageForContinuitySubject(
  session: DatabaseSession,
  owner: Extract<AssetOwner, { kind: 'castMember' | 'location' | 'prop' }>
): ScreenplayImageReference | undefined {
  const page = listAssetPageInSession(session, { owner, mediaKind: 'image' });
  const asset = page.items.find((candidate) => candidate.id === page.selectedAssetId);
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function toScreenplayImageReference(asset: Asset): ScreenplayImageReference | undefined {
  const file =
    asset.files.find(
      (candidate) => candidate.role === 'primary' && candidate.mediaKind === 'image'
    ) ?? asset.files.find((candidate) => candidate.mediaKind === 'image');
  return file
    ? {
        assetId: asset.id,
        assetFileId: file.id,
        title: asset.title,
        fileRole: file.role,
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
      }
    : undefined;
}

function castVoiceSampleSource(voice: ReturnType<typeof listCastVoiceRecords>[number]) {
  if (voice.sampleSourceKind === 'elevenlabs_voice_sample') {
    if (!voice.sampleId || !voice.sampleFetchedAt || !voice.sampleApiBaseUrl) {
      throw new ProjectDataError(
        'PROJECT_DATA357',
        `Cast Voice ${voice.id} is missing ElevenLabs sample provenance.`
      );
    }
    return {
      kind: 'elevenlabs_voice_sample' as const,
      sampleId: voice.sampleId,
      fetchedAt: voice.sampleFetchedAt,
      apiBaseUrl: voice.sampleApiBaseUrl,
    };
  }
  return voice.sampleSourceKind === 'generated_sample'
    ? { kind: 'generated_sample' as const }
    : { kind: 'custom_file' as const };
}

function toCastVoiceProviderRegistration(
  record: CastVoiceProviderRegistrationRecord
): CastVoiceProviderRegistration {
  return {
    id: record.id,
    castVoiceId: record.castVoiceId,
    provider: toCastVoiceProvider(record.provider, record.id),
    registrationModel: toCastVoiceProviderRegistrationModel(
      record.registrationModel,
      record.id
    ),
    externalVoiceId: record.externalVoiceId,
    capabilities: parseRegistrationCapabilities(record),
    sourceSampleAssetId: record.sourceSampleAssetId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toCastVoiceProvider(
  provider: string,
  registrationId: string
): CastVoiceProviderRegistration['provider'] {
  if (provider === 'elevenlabs') {
    return provider;
  }
  throw new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has unsupported provider: ${provider}.`
  );
}

function toCastVoiceProviderRegistrationModel(
  model: string,
  registrationId: string
): CastVoiceProviderRegistration['registrationModel'] {
  if (
    model === 'eleven_v3' ||
    model === 'eleven_multilingual_v2' ||
    model === 'eleven_turbo_v2_5'
  ) {
    return model;
  }
  throw new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has unsupported model: ${model}.`
  );
}

function parseRegistrationCapabilities(
  record: CastVoiceProviderRegistrationRecord
): CastVoiceProviderCapability[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(record.capabilitiesJson);
  } catch {
    throw invalidRegistrationCapabilities(record.id);
  }
  if (!Array.isArray(parsed)) {
    throw invalidRegistrationCapabilities(record.id);
  }
  return Array.from(new Set(parsed.map((candidate) => {
    if (candidate === 'dialogue-audio-tts') {
      return candidate;
    }
    throw invalidRegistrationCapabilities(record.id);
  })));
}

function invalidRegistrationCapabilities(registrationId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has invalid capabilities.`
  );
}

function requireCastMember(session: DatabaseSession, castMemberId: string) {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throwNotFound('Cast Member', castMemberId);
  }
  return {
    id: castMember.id,
    handle: castMember.handle,
    name: castMember.name,
    isVoiceOver: castMember.isVoiceOver,
    ...(castMember.role ? { role: castMember.role } : {}),
    ...(castMember.age !== null ? { age: castMember.age } : {}),
    ...(castMember.want ? { want: castMember.want } : {}),
    ...(castMember.need ? { need: castMember.need } : {}),
    ...(castMember.arc ? { arc: castMember.arc } : {}),
    ...(castMember.voiceNotes ? { voiceNotes: castMember.voiceNotes } : {}),
    ...(castMember.description ? { description: castMember.description } : {}),
  };
}

function requireLocation(session: DatabaseSession, locationId: string) {
  const location = readLocationRecord(session, locationId);
  if (!location) {
    throwNotFound('Location', locationId);
  }
  return {
    id: location.id,
    handle: location.handle,
    name: location.name,
    ...(location.timePeriod ? { timePeriod: location.timePeriod } : {}),
    ...(location.description ? { description: location.description } : {}),
    ...(location.visualNotes ? { visualNotes: location.visualNotes } : {}),
  };
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA205',
    `${label} was not found: ${id}.`,
    { suggestion: 'Check the id from the latest continuity resource.' }
  );
}
