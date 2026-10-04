import type {
  AssetFile,
  AssetFileOwner,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  PropOverviewResource,
  PropResource,
  ScreenplayImageReference,
} from '../../client/index.js';
import { listAssetFilePageInSession } from '../asset-files/projection.js';
import { listCastVoicesInSession } from '../cast-voices/projection.js';
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
import { readSelectedLocationWorldInSession } from '../location-worlds/asset-files.js';

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
    return readCastMemberResourceFromSession(session, input.castMemberId);
  } finally {
    session.close();
  }
}

export function readCastMemberResourceFromSession(
  session: DatabaseSession,
  castMemberId: string,
): CastMemberResource {
  return {
      castMember: requireCastMember(session, castMemberId),
      firstImage: firstImageForContinuitySubject(session, {
        kind: 'castMember',
        id: castMemberId,
      }),
      voices: listCastVoicesInSession(session, castMemberId),
    };
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
  owner: Extract<AssetFileOwner, { kind: 'castMember' | 'location' | 'prop' }>
): ScreenplayImageReference | undefined {
  const page = listAssetFilePageInSession(session, { owner, mediaKind: 'image' });
  const assetFile = page.items.find((candidate) => candidate.id === page.selectedAssetFileId);
  return assetFile ? toScreenplayImageReference(assetFile) : undefined;
}

function toScreenplayImageReference(assetFile: AssetFile): ScreenplayImageReference | undefined {
  const file = assetFile.mediaKind === 'image' ? assetFile : null;
  return file
    ? {
        assetFileId: file.id,
        title: assetFile.title,
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
        width: file.width,
        height: file.height,
      }
    : undefined;
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
