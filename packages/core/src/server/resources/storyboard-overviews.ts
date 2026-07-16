import type {
  ActStoryboardResource,
  ActStoryboardScene,
  ActStoryboardSequence,
  ActStoryboardBeat,
  Asset,
  ScreenplayImageReference,
  SequenceSceneStoryboardPreview,
} from '../../client/index.js';
import type {
  Beat,
  SceneBeatSheetDocument,
} from '../../client/scene-beat-sheet.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  listSceneNavigationPage,
  listSequenceNavigationPage,
  readActNavigationRow,
} from '../database/access/navigation.js';
import {
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
} from '../database/access/scene-beat-sheets.js';
import {
  listSceneBeatStoryboardImageRecords,
} from '../database/access/scene-beat-storyboard-images.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type {
  ReadActStoryboardResourceInput,
} from '../project-data-service-contracts.js';

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
    return { scene, beats: [] };
  }
  const beats: ActStoryboardBeat[] = projection.document.beats.map(
    (beat, index) => ({
      beatId: beat.id,
      label: beatLabel(index),
      title: beat.title,
      image: projection.imagesByBeatId[beat.id] ?? null,
    })
  );
  return { scene, beats };
}

export function readActiveSceneStoryboardPreviewImage(
  session: DatabaseSession,
  sceneId: string
): ScreenplayImageReference | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  const firstBeatWithImage = projection.document?.beats.find(
    (beat) => projection.imagesByBeatId[beat.id]
  );
  return firstBeatWithImage
    ? projection.imagesByBeatId[firstBeatWithImage.id] ?? null
    : null;
}

export function readSceneStoryboardPreview(
  session: DatabaseSession,
  sceneId: string
): SequenceSceneStoryboardPreview | null {
  const projection = readSceneStoryboardProjection(session, sceneId);
  if (!projection.document || !projection.beatSheetId) {
    return null;
  }
  const selected = selectStoryboardPreviewBeats(
    projection.document.beats,
    projection.imagesByBeatId
  );
  return selected.length
    ? { beatSheetId: projection.beatSheetId, images: selected }
    : null;
}

export interface SceneStoryboardProjection {
  document: SceneBeatSheetDocument | null;
  beatSheetId: string | null;
  imagesByBeatId: Record<string, ScreenplayImageReference>;
}

export function readSceneStoryboardProjection(
  session: DatabaseSession,
  sceneId: string
): SceneStoryboardProjection {
  const beatSheetRow = readActiveSceneBeatSheetRecord(session, sceneId);
  if (!beatSheetRow) {
    return { document: null, beatSheetId: null, imagesByBeatId: {} };
  }
  const screenplay = requireScreenplayDocument(session);
  const document = readSceneBeatSheetDocument({ row: beatSheetRow, screenplay });

  const imagesByBeatId: Record<string, ScreenplayImageReference> = {};
  for (const image of listSceneBeatStoryboardImageRecords(session, {
    beatSheetId: beatSheetRow.id,
  })) {
    if (imagesByBeatId[image.beatId]) {
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
      imagesByBeatId[image.beatId] = reference;
    }
  }

  return {
    document,
    beatSheetId: beatSheetRow.id,
    imagesByBeatId,
  };
}

function selectStoryboardPreviewBeats(
  beats: Beat[],
  imagesByBeatId: Record<string, ScreenplayImageReference>
): SequenceSceneStoryboardPreview['images'] {
  const preferredIndexes = preferredPreviewIndexes(beats.length);
  const selectedIndexes: number[] = [];
  for (const index of preferredIndexes) {
    const nearest = nearestAvailablePreviewIndex({
      beats,
      imagesByBeatId,
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
      const beat = beats[index]!;
      return { beatId: beat.id, image: imagesByBeatId[beat.id] ?? null };
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
  beats: Beat[];
  imagesByBeatId: Record<string, ScreenplayImageReference>;
  preferredIndex: number;
  selectedIndexes: number[];
}): number | null {
  const selected = new Set(input.selectedIndexes);
  for (let distance = 0; distance < input.beats.length; distance += 1) {
    const candidates =
      distance === 0
        ? [input.preferredIndex]
        : [input.preferredIndex - distance, input.preferredIndex + distance];
    for (const index of candidates) {
      const beat = input.beats[index];
      if (
        beat &&
        !selected.has(index) &&
        input.imagesByBeatId[beat.id]
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

function beatLabel(index: number): string {
  return `Beat ${index + 1}`;
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
