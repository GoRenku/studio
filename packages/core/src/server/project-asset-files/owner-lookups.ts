import { listAssetFileRecordsForAsset, readAssetFileRecord } from '../database/access/asset-files.js';
import type { AssetFileRecord } from '../database/access/asset-files.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import { readPropRecord } from '../database/access/props.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';

export function imageEditSourceFile(
  session: DatabaseSession,
  input: { sourceAssetId: string; sourceAssetFileId?: string }
): AssetFileRecord {
  if (!input.sourceAssetId) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_IMAGE_EDIT_SOURCE_REQUIRED',
      'Image edit output placement requires a source asset id.'
    );
  }
  const source = input.sourceAssetFileId
    ? readAssetFileRecord(session, {
        assetId: input.sourceAssetId,
        assetFileId: input.sourceAssetFileId,
      })
    : singleActiveImageFile(session, input.sourceAssetId);
  if (!source) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_IMAGE_EDIT_SOURCE_MISSING',
      `Image edit source asset file was not found for asset: ${input.sourceAssetId}.`
    );
  }
  return source;
}

export function singleActiveImageFile(
  session: DatabaseSession,
  assetId: string
): AssetFileRecord | null {
  const imageFiles = listAssetFileRecordsForAsset(session, assetId).filter(
    (file) => file.mediaKind === 'image'
  );
  return imageFiles.length === 1 ? imageFiles[0]! : null;
}

export function requireCastMember(session: DatabaseSession, castMemberId: string) {
  const castMember = readCastMemberRecord(session, castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Cast member was not found for project asset file destination: ${castMemberId}.`
    );
  }
  return castMember;
}

export function requireLocation(session: DatabaseSession, locationId: string) {
  const location = readLocationRecord(session, locationId);
  if (!location) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Location was not found for project asset file destination: ${locationId}.`
    );
  }
  return location;
}

export function requireProp(session: DatabaseSession, propId: string) {
  const prop = readPropRecord(session, propId);
  if (!prop) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Prop was not found for project asset file destination: ${propId}.`
    );
  }
  return prop;
}

export function requireSceneStorageContext(
  session: DatabaseSession | undefined,
  sceneId: string
): { sceneId: string; productionNumber: string; displayNumber: string } {
  if (!session) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene storage lookup requires a database session.'
    );
  }
  const screenplay = readCanonicalScreenplay(session);
  const scene = screenplay.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Scene was not found for project asset file destination: ${sceneId}.`
    );
  }
  if (scene.productionNumber === undefined) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SCENE_NUMBER_REQUIRED',
      `Scene ${sceneId} requires a production number before durable media can be attached.`,
      {
        suggestion:
          'Assign the Scene number through the accepted screenplay workflow, then retry the attachment.',
      }
    );
  }
  return {
    sceneId,
    productionNumber: scene.productionNumber,
    displayNumber: scene.productionNumber,
  };
}
