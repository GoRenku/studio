import type {
  Asset,
  ScreenplayImageReference,
  SequenceSceneStoryboardPreview,
} from '../../client/index.js';
import type {
  Beat,
  SceneBeatSheetDocument,
} from '../../client/scene-beats/index.js';
import { listAssetPageInSession } from '../assets/projection.js';
import {
  readActiveSceneBeatSheetRecord,
  readSceneBeatSheetDocument,
} from '../database/access/scene-beat-sheets.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

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
  const document = readSceneBeatSheetDocument({ row: beatSheetRow });

  const imagesByBeatId: Record<string, ScreenplayImageReference> = {};
  for (const beat of document.beats) {
    const page = listAssetPageInSession(session, {
      owner: { kind: 'sceneBeat', sceneId, beatId: beat.id },
      type: 'scene_storyboard_image',
    });
    const asset = page.items.find((candidate) => candidate.id === page.selectedAssetId);
    const file = asset?.files.find((candidate) => candidate.mediaKind === 'image');
    const reference = asset && file ? toImageReferenceForFile(asset, file.id) : null;
    if (reference) {
      imagesByBeatId[beat.id] = reference;
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
    assetId: asset.id,
    assetFileId: file.id,
    title: asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  };
}
