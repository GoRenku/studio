import type {
  AssetTarget,
  Asset,
  CastVoiceProviderCapability,
  CastVoiceProviderRegistration,
  CastMemberResource,
  CastOverviewResource,
  LocationOverviewResource,
  LocationResource,
  SceneNarrativeResource,
  ScreenplayImageReference,
  SequenceResource,
  StoryArcResource,
} from '../../client/index.js';
import { readSceneDialogueAudioContext } from '../media-generation/scene-dialogue-audio.js';
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
import {
  readActiveScreenplayAnalysisRecord,
  readScreenplayAnalysisDocument,
} from '../database/access/screenplay-analysis.js';
import {
  listAssetRelationshipPage,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  listCastVoiceProviderRegistrationRecords,
  listCastVoiceRecords,
  type CastVoiceProviderRegistrationRecord,
} from '../database/access/cast-voices.js';
import {
  readScreenplayCastMemberFromSession,
  readScreenplayDocumentFromSession,
  readScreenplayLocationFromSession,
  readScreenplaySceneFromSession,
  readScreenplaySequenceFromSession,
} from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readSceneStoryboardPreview } from './scene-storyboard-ui.js';
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
      voices: listCastVoiceRecords(session, input.castMemberId).map((voice) => {
        const sample = readAssetRelationship(session, {
          target: { kind: 'castMember', castMemberId: input.castMemberId },
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
  return Array.from(
    new Set(
      parsed.map((candidate) => {
        if (candidate === 'dialogue-audio-tts') {
          return candidate;
        }
        throw invalidRegistrationCapabilities(record.id);
      })
    )
  );
}

function invalidRegistrationCapabilities(registrationId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA358',
    `Cast Voice provider registration ${registrationId} has invalid capabilities.`
  );
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
    const activeAnalysisRow = readActiveScreenplayAnalysisRecord(session);
    return {
      screenplay: {
        title: document.screenplay.title,
        logline: document.screenplay.logline,
        dramaticQuestion: document.screenplay.dramaticQuestion,
        premiseOverview: document.screenplay.premiseOverview,
        centralConflict: document.screenplay.centralConflict,
        summary: document.screenplay.summary,
      },
      acts: actPage.items.map((act) => ({
        ...act,
        sequences: listSequenceNavigationPage(session, {
          actId: act.id,
          limit: 200,
        }).items.map((sequence) => ({
          ...sequence,
          scenes: listSceneNavigationPage(session, {
            sequenceId: sequence.id,
            limit: 200,
          }).items.map((scene) => ({
            ...scene,
            storyFunction: findScreenplayDocumentScene(document, scene.id)?.storyFunction,
          })),
        })),
      })),
      activeAnalysis: activeAnalysisRow
        ? readScreenplayAnalysisDocument({
            row: activeAnalysisRow,
            screenplay: document,
          })
        : null,
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
    const scenes = listSceneNavigationPage(session, {
      sequenceId: input.sequenceId,
      limit: input.limit,
      cursor: input.cursor,
    });
    return {
      act,
      sequence: sequenceContext.sequence,
      scenes: {
        ...scenes,
        items: scenes.items.map((scene) => {
          const storyboardPreview = readSceneStoryboardPreview(
            session,
            scene.id
          );
          return storyboardPreview ? { ...scene, storyboardPreview } : scene;
        }),
      },
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
      castMemberImages: Object.fromEntries(
        document.cast.flatMap((castMember) => {
          if (!castMember.id) {
            return [];
          }
          const image = firstImageForTarget(session, {
            kind: 'castMember',
            castMemberId: castMember.id,
          });
          return image ? [[castMember.id, image]] : [];
        })
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
      dialogueAudio: await readSceneDialogueAudioContext(input),
    };
  } finally {
    session.close();
  }
}

function findScreenplayDocumentScene(
  document: ReturnType<typeof requireScreenplayDocument>,
  sceneId: string
) {
  for (const act of document.acts) {
    for (const sequence of act.sequences) {
      const scene = sequence.scenes.find((candidate) => candidate.id === sceneId);
      if (scene) {
        return scene;
      }
    }
  }
  return undefined;
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
  const asset = firstPreferredImageAsset(session, target);
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function firstPreferredImageAsset(
  session: DatabaseSession,
  target: AssetTarget
): Asset | undefined {
  if (target.kind === 'castMember') {
    return (
      listAssetRelationshipPage(session, {
        target,
        role: 'profile',
        mediaKind: 'image',
        selection: 'select',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        role: 'profile',
        mediaKind: 'image',
        selection: 'take',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        role: 'character_sheet',
        mediaKind: 'image',
        selection: 'select',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        mediaKind: 'image',
        selection: 'select',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        mediaKind: 'image',
        selection: 'take',
        limit: 1,
      }).items[0]
    );
  }
  if (target.kind === 'location') {
    return (
      listAssetRelationshipPage(session, {
        target,
        role: 'environment_sheet',
        mediaKind: 'image',
        selection: 'select',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        mediaKind: 'image',
        selection: 'select',
        limit: 1,
      }).items[0] ??
      listAssetRelationshipPage(session, {
        target,
        mediaKind: 'image',
        selection: 'take',
        limit: 1,
      }).items[0]
    );
  }
  return listAssetRelationshipPage(session, {
    target,
    mediaKind: 'image',
    limit: 1,
  }).items[0];
}

function toScreenplayImageReference(asset: Asset): ScreenplayImageReference | undefined {
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
