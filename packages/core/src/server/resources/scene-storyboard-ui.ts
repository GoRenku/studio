import type {
  ActStoryboardResource,
  ActStoryboardScene,
  ActStoryboardSequence,
  ActStoryboardShot,
  Asset,
  SceneShotListResource,
  SceneStoryboardSheetReference,
  ScreenplayImageReference,
} from '../../client/index.js';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import { ProjectDataError } from '../project-data-error.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import {
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
  readSceneNavigationContext,
} from '../database/access/navigation.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  listSceneShotStoryboardImageRecords,
  listSceneShotStoryboardSheetRecords,
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
    const screenplay = readScreenplayDocumentFromSession(session);
    return {
      scene: context.scene,
      sequence: context.sequence,
      act,
      projectAspectRatio: readProjectRecord(session)?.aspectRatio ?? null,
      activeShotList: projection.document,
      storyboardSheet: projection.sheetReference,
      storyboardImagesByShotId: projection.imagesByShotId,
      castMemberLabels: screenplay
        ? Object.fromEntries(
            screenplay.cast.map((castMember) => [castMember.id, castMember.name])
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
  // An empty `shots` array signals a single scene placeholder slot: render
  // shots only when the scene has an active shot list with imported images.
  if (!projection.document || !projection.sheetReference) {
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

export function readActiveSceneStoryboardSheetImage(
  session: DatabaseSession,
  sceneId: string
): ScreenplayImageReference | null {
  return readSceneStoryboardProjection(session, sceneId).sheetReference?.sheet ?? null;
}

interface SceneStoryboardProjection {
  document: SceneShotListDocument | null;
  sheetReference: SceneStoryboardSheetReference | null;
  imagesByShotId: Record<string, ScreenplayImageReference>;
}

function readSceneStoryboardProjection(
  session: DatabaseSession,
  sceneId: string
): SceneStoryboardProjection {
  const shotListRow = readActiveSceneShotListRecord(session, sceneId);
  if (!shotListRow) {
    return { document: null, sheetReference: null, imagesByShotId: {} };
  }
  const screenplay = requireScreenplayDocument(session);
  const document = readSceneShotListDocument({ row: shotListRow, screenplay });

  // Records are returned newest-first. A single import can produce several sheet
  // records (one compound asset, shots split across sheets), so resolve every
  // sheet that belongs to the most recent import — keyed by its asset id — not
  // just the first sheet record. Otherwise shots living on the other sheets of
  // the same import render as empty placeholders.
  const sheetRecords = listSceneShotStoryboardSheetRecords(
    session,
    shotListRow.id
  );
  const latestSheet = sheetRecords[0];
  if (!latestSheet) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }
  const importSheets = sheetRecords.filter(
    (record) => record.assetId === latestSheet.assetId
  );

  const asset = readAssetRelationship(session, {
    target: { kind: 'scene', sceneId },
    assetId: latestSheet.assetId,
  });
  if (!asset) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }

  const sheet = toImageReferenceForFile(asset, latestSheet.sheetFileId);
  if (!sheet) {
    return { document, sheetReference: null, imagesByShotId: {} };
  }

  const imagesByShotId: Record<string, ScreenplayImageReference> = {};
  for (const sheetRecord of importSheets) {
    for (const image of listSceneShotStoryboardImageRecords(
      session,
      sheetRecord.id
    )) {
      const reference = toImageReferenceForFile(asset, image.assetFileId);
      if (reference) {
        imagesByShotId[image.shotId] = reference;
      }
    }
  }

  return {
    document,
    sheetReference: { shotListId: shotListRow.id, sheet },
    imagesByShotId,
  };
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
