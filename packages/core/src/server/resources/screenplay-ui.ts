import type {
  AssetTarget,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  SceneNarrativeResource,
  ScreenplayImageReference,
  SequenceResource,
  StoryArcResource,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listActNavigationPage,
  listCastNavigationPage,
  listLocationNavigationPage,
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
  readSequenceNavigationContext,
} from '../database/access/navigation.js';
import { listAssetRelationshipPage } from '../database/access/asset-relationships/index.js';
import {
  readScreenplayCastMemberFromSession,
  readScreenplayDocumentFromSession,
  readScreenplayLocationFromSession,
  readScreenplaySceneFromSession,
  readScreenplaySequenceFromSession,
} from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ListNavigationInput,
  ReadCastMemberResourceInput,
  ReadLocationResourceInput,
  ReadProjectInput,
  ReadSceneNarrativeResourceInput,
  ReadSequenceResourceInput,
} from '../project-data-service-contracts.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function readCastOverviewResource(
  input: ListNavigationInput
): Promise<CastOverviewResource> {
  const { session } = await openProjectSession(input);
  try {
    return {
      cast: mapCastImages(
        session,
        listCastNavigationPage(session, input)
      ),
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
      castMember: requireCastMemberId(
        readScreenplayCastMemberFromSession(session, input.castMemberId)
      ),
      firstImage: firstImageForTarget(session, {
        kind: 'castMember',
        castMemberId: input.castMemberId,
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
          firstImage: firstImageForTarget(session, {
            kind: 'location',
            locationId: location.id,
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
      location: requireLocationId(
        readScreenplayLocationFromSession(session, input.locationId)
      ),
      firstImage: firstImageForTarget(session, {
        kind: 'location',
        locationId: input.locationId,
      }),
    };
  } finally {
    session.close();
  }
}

export async function readStoryArcResource(
  input: ReadProjectInput
): Promise<StoryArcResource> {
  const { session } = await openProjectSession(input);
  try {
    const document = requireScreenplayDocument(session);
    const actPage = listActNavigationPage(session, { limit: 200 });
    return {
      screenplay: {
        title: document.screenplay.title,
        logline: document.screenplay.logline,
        dramaticQuestion: document.screenplay.dramaticQuestion,
        premiseOverview: document.screenplay.premiseOverview,
        centralConflict: document.screenplay.centralConflict,
        summary: document.screenplay.summary,
        storyArc: document.screenplay.storyArc,
      },
      acts: actPage.items.map((act) => ({
        ...act,
        sequences: listSequenceNavigationPage(session, {
          actId: act.id,
          limit: 200,
        }).items,
      })),
    };
  } finally {
    session.close();
  }
}

export async function readSequenceResource(
  input: ReadSequenceResourceInput
): Promise<SequenceResource> {
  const { session } = await openProjectSession(input);
  try {
    const sequenceContext = readSequenceNavigationContext(session, input.sequenceId);
    if (!sequenceContext) {
      throwNotFound('sequence', input.sequenceId);
    }
    const act = readActNavigationRow(session, sequenceContext.sequence.actId);
    if (!act) {
      throwNotFound('act', sequenceContext.sequence.actId);
    }
    readScreenplaySequenceFromSession(session, input.sequenceId);
    return {
      act,
      sequence: sequenceContext.sequence,
      scenes: listSceneNavigationPage(session, {
        sequenceId: input.sequenceId,
        limit: input.limit,
        cursor: input.cursor,
      }),
    };
  } finally {
    session.close();
  }
}

export async function readSceneNarrativeResource(
  input: ReadSceneNarrativeResourceInput
): Promise<SceneNarrativeResource> {
  const { session } = await openProjectSession(input);
  try {
    const context = readSceneNavigationContext(session, input.sceneId);
    if (!context) {
      throwNotFound('scene', input.sceneId);
    }
    const act = readActNavigationRow(session, context.sequence.actId);
    if (!act) {
      throwNotFound('act', context.sequence.actId);
    }
    const scene = readScreenplaySceneFromSession(session, input.sceneId);
    const document = requireScreenplayDocument(session);
    return {
      act,
      sequence: context.sequence,
      scene,
      blocks: scene.blocks,
      castMemberLabels: Object.fromEntries(
        document.cast.map((castMember) => [castMember.id, castMember.name])
      ),
      locationLabels: Object.fromEntries(
        document.locations.map((location) => [location.id, location.name])
      ),
      castMemberHandles: Object.fromEntries(
        document.cast
          .filter((castMember) => castMember.handle && castMember.id)
          .map((castMember) => [castMember.handle.toLowerCase(), castMember.id as string])
      ),
      locationHandles: Object.fromEntries(
        document.locations
          .filter((location) => location.handle && location.id)
          .map((location) => [location.handle.toLowerCase(), location.id as string])
      ),
    };
  } finally {
    session.close();
  }
}

function mapCastImages(
  session: DatabaseSession,
  page: CastOverviewResource['cast']
): CastOverviewResource['cast'] {
  return {
    ...page,
    items: page.items.map((castMember) => ({
      ...castMember,
      firstImage: firstImageForTarget(session, {
        kind: 'castMember',
        castMemberId: castMember.id,
      }),
    })),
  };
}

function firstImageForTarget(
  session: DatabaseSession,
  target: AssetTarget
): ScreenplayImageReference | undefined {
  const asset = listAssetRelationshipPage(session, {
    target,
    mediaKind: 'image',
    limit: 1,
  }).items[0];
  const file = asset?.files.find((candidate) => candidate.mediaKind === 'image');
  if (!asset || !file) {
    return undefined;
  }
  return {
    assetId: asset.assetId,
    relationshipId: asset.relationshipId,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}

function requireScreenplayDocument(session: DatabaseSession) {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    throw new ProjectDataError('PROJECT_DATA205', 'No screenplay data exists.', {
      suggestion: 'Create screenplay data before opening this surface.',
    });
  }
  return document;
}

function throwNotFound(label: string, id: string): never {
  throw new ProjectDataError(
    'PROJECT_DATA205',
    `No ${label} was found for this screenplay request: ${id}.`,
    { suggestion: 'Check the id from the latest screenplay resource.' }
  );
}

function requireCastMemberId(
  castMember: ReturnType<typeof readScreenplayCastMemberFromSession>
) {
  if (!castMember.id) {
    throwNotFound('cast member', castMember.handle);
  }
  return {
    ...castMember,
    id: castMember.id,
  };
}

function requireLocationId(
  location: ReturnType<typeof readScreenplayLocationFromSession>
) {
  if (!location.id) {
    throwNotFound('location', location.handle);
  }
  return {
    ...location,
    id: location.id,
  };
}
