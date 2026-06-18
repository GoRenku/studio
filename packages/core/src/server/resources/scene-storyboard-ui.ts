import type {
  ActStoryboardResource,
  ActStoryboardScene,
  ActStoryboardSequence,
  ActStoryboardShot,
  Asset,
  SceneShotListResource,
  ScreenplayImageReference,
  SequenceSceneStoryboardPreview,
} from '../../client/index.js';
import type {
  SceneShot,
  SceneShotListDocument,
} from '../../client/scene-shot-list.js';
import type { ScreenplayDocument } from '../../client/screenplay.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  listAssetRelationshipPage,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
} from '../database/access/navigation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotStoryboardImageRecords,
  readActiveSceneShotListRecord,
  readSceneShotListDocument,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadActStoryboardResourceInput,
  ReadSceneShotListResourceInput,
} from '../project-data-service-contracts.js';

export async function readSceneShotListResource(
  input: ReadSceneShotListResourceInput
): Promise<SceneShotListResource> {
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
    const projection = readSceneStoryboardProjection(session, input.sceneId);
    const screenplay = requireScreenplayDocumentFromSession(session);
    return {
      scene: context.scene,
      sequence: context.sequence,
      act,
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeShotListId:
        readActiveSceneShotListRecord(session, input.sceneId)?.id ?? null,
      activeShotList: projection.document,
      storyboardImagesByShotId: projection.imagesByShotId,
      castMemberLabels: screenplay
        ? Object.fromEntries(
            screenplay.cast.map((castMember) => [castMember.id, castMember.name])
          )
        : {},
      castMemberImages: screenplay
        ? Object.fromEntries(
            screenplay.cast.flatMap((castMember) => {
              if (!castMember.id) {
                return [];
              }
              const image = firstCastMemberImage(session, castMember.id);
              return image ? [[castMember.id, image]] : [];
            })
          )
        : {},
      locationLabels: screenplay
        ? Object.fromEntries(
            screenplay.locations.map((location) => [location.id, location.name])
          )
        : {},
    };
  } finally {
    session.close();
  }
}

function firstCastMemberImage(
  session: DatabaseSession,
  castMemberId: string
): ScreenplayImageReference | undefined {
  const target = { kind: 'castMember' as const, castMemberId };
  const asset =
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
    }).items[0];
  return asset ? toScreenplayImageReference(asset) : undefined;
}

function toScreenplayImageReference(
  asset: Asset
): ScreenplayImageReference | undefined {
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!file) {
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

function requireScreenplayDocumentFromSession(
  session: DatabaseSession
): ScreenplayDocument {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_DATA012',
      'Project has no screenplay document.',
      { suggestion: 'Create or import a screenplay before editing shot references.' }
    );
  }
  return screenplay;
}

export async function readActStoryboardResource(
  input: ReadActStoryboardResourceInput
): Promise<ActStoryboardResource> {
  const { session } = await openProjectSession(input);
  try {
    const act = readActNavigationRow(session, input.actId);
    if (!act) {
      throwNotFound('act', input.actId);
    }
    const sequences: ActStoryboardSequence[] = listSequenceNavigationPage(
      session,
      { actId: input.actId, limit: 200 }
    ).items.map((sequence) => ({
      sequence,
      scenes: listSceneNavigationPage(session, {
        sequenceId: sequence.id,
        limit: 200,
      }).items.map((scene) => toActStoryboardScene(session, scene)),
    }));
    return { act, sequences };
  } finally {
    session.close();
  }
}

function toActStoryboardScene(
  session: DatabaseSession,
  scene: ActStoryboardScene['scene']
): ActStoryboardScene {
  const projection = readSceneStoryboardProjection(session, scene.id);
  if (!projection.document) {
    return { scene, shots: [] };
  }
  const shots: ActStoryboardShot[] = projection.document.shots.map(
    (shot, index) => ({
      shotId: shot.shotId,
      label: shotLabel(index),
      title: shot.title,
      image: projection.imagesByShotId[shot.shotId] ?? null,
    })
  );
  return { scene, shots };
}

export function readActiveSceneStoryboardPreviewImage(
  session: DatabaseSession,
  sceneId: string
): ScreenplayImageReference | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  const firstShotWithImage = projection.document?.shots.find(
    (shot) => projection.imagesByShotId[shot.shotId]
  );
  return firstShotWithImage
    ? projection.imagesByShotId[firstShotWithImage.shotId] ?? null
    : null;
}

export function readSceneStoryboardPreview(
  session: DatabaseSession,
  sceneId: string
): SequenceSceneStoryboardPreview | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  if (!projection.document || !projection.shotListId) {
    return null;
  }
  const selected = selectStoryboardPreviewShots(
    projection.document.shots,
    projection.imagesByShotId
  );
  return selected.length
    ? { shotListId: projection.shotListId, images: selected }
    : null;
}

interface SceneStoryboardProjection {
  document: SceneShotListDocument | null;
  shotListId: string | null;
  imagesByShotId: Record<string, ScreenplayImageReference>;
}

function readSceneStoryboardProjection(
  session: DatabaseSession,
  sceneId: string
): SceneStoryboardProjection {
  const shotListRow = readActiveSceneShotListRecord(session, sceneId);
  if (!shotListRow) {
    return { document: null, shotListId: null, imagesByShotId: {} };
  }
  const screenplay = requireScreenplayDocument(session);
  const document = readSceneShotListDocument({ row: shotListRow, screenplay });

  const imagesByShotId: Record<string, ScreenplayImageReference> = {};
  for (const image of listSceneShotStoryboardImageRecords(session, {
    shotListId: shotListRow.id,
  })) {
    if (imagesByShotId[image.shotId]) {
      continue;
    }
    const asset = readAssetRelationship(session, {
      target: { kind: 'scene', sceneId },
      assetId: image.assetId,
    });
    if (!asset) {
      continue;
    }
    const reference = toImageReferenceForFile(asset, image.assetFileId);
    if (reference) {
      imagesByShotId[image.shotId] = reference;
    }
  }

  return {
    document,
    shotListId: shotListRow.id,
    imagesByShotId,
  };
}

function selectStoryboardPreviewShots(
  shots: SceneShot[],
  imagesByShotId: Record<string, ScreenplayImageReference>
): SequenceSceneStoryboardPreview['images'] {
  const preferredIndexes = preferredPreviewIndexes(shots.length);
  const selectedIndexes: number[] = [];
  for (const index of preferredIndexes) {
    const nearest = nearestAvailablePreviewIndex({
      shots,
      imagesByShotId,
      preferredIndex: index,
      selectedIndexes,
    });
    if (nearest !== null) {
      selectedIndexes.push(nearest);
    }
  }
  return selectedIndexes
    .sort((left, right) => left - right)
    .map((index) => {
      const shot = shots[index]!;
      return { shotId: shot.shotId, image: imagesByShotId[shot.shotId] ?? null };
    });
}

function preferredPreviewIndexes(length: number): number[] {
  if (length <= 0) {
    return [];
  }
  if (length <= 4) {
    return Array.from({ length }, (_, index) => index);
  }
  return [0, 1, length - 2, length - 1];
}

function nearestAvailablePreviewIndex(input: {
  shots: SceneShot[];
  imagesByShotId: Record<string, ScreenplayImageReference>;
  preferredIndex: number;
  selectedIndexes: number[];
}): number | null {
  const selected = new Set(input.selectedIndexes);
  for (let distance = 0; distance < input.shots.length; distance += 1) {
    const candidates =
      distance === 0
        ? [input.preferredIndex]
        : [input.preferredIndex - distance, input.preferredIndex + distance];
    for (const index of candidates) {
      const shot = input.shots[index];
      if (
        shot &&
        !selected.has(index) &&
        input.imagesByShotId[shot.shotId]
      ) {
        return index;
      }
    }
  }
  return null;
}

function toImageReferenceForFile(
  asset: Asset,
  assetFileId: string
): ScreenplayImageReference | null {
  const file = asset.files.find((candidate) => candidate.id === assetFileId);
  if (!file) {
    return null;
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

function shotLabel(index: number): string {
  return `Shot ${index + 1}`;
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
