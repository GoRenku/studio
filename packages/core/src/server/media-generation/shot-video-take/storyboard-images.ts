import type {
  Asset,
  ShotVideoTakeStoryboardImageReference,
} from '../../../client/index.js';
import {
  readAssetRelationship,
} from '../../database/access/asset-relationships/index.js';
import {
  listSceneShotStoryboardImageRecords,
} from '../../database/access/scene-shot-lists.js';
import type {
  DatabaseSession,
} from '../../database/lifecycle/store.js';

export function listShotVideoTakeStoryboardImages(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
}): ShotVideoTakeStoryboardImageReference[] {
  const images: ShotVideoTakeStoryboardImageReference[] = [];
  const seenShotIds = new Set<string>();
  for (const image of listSceneShotStoryboardImageRecords(input.session, {
    shotListId: input.shotListId,
  })) {
    if (seenShotIds.has(image.shotId)) {
      continue;
    }
    const asset = readAssetRelationship(input.session, {
      target: { kind: 'scene', sceneId: input.sceneId },
      assetId: image.assetId,
    });
    if (!asset) {
      continue;
    }
    const reference = toShotVideoTakeStoryboardImageReference({
      shotId: image.shotId,
      asset,
      assetFileId: image.assetFileId,
    });
    if (!reference) {
      continue;
    }
    images.push(reference);
    seenShotIds.add(image.shotId);
  }
  return images;
}

function toShotVideoTakeStoryboardImageReference(input: {
  shotId: string;
  asset: Asset;
  assetFileId: string;
}): ShotVideoTakeStoryboardImageReference | null {
  const file = input.asset.files.find(
    (candidate) => candidate.id === input.assetFileId
  );
  if (!file) {
    return null;
  }
  return {
    shotId: input.shotId,
    assetId: input.asset.assetId,
    relationshipId: input.asset.relationshipId,
    assetFileId: file.id,
    title: input.asset.title,
    fileRole: file.role,
    mediaKind: file.mediaKind,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
    projectRelativePath: file.projectRelativePath,
  };
}
