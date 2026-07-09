import { listAssetFileRecordsForAsset, readAssetFileRecord } from '../database/access/asset-files.js';
import type { AssetFileRecord } from '../database/access/asset-files.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { readLocationRecord } from '../database/access/locations.js';
import {
  listSceneShotVideoTakeStorageRecordsForScene,
  requireSceneShotVideoTakeStorageRecord,
} from '../database/access/project-asset-file-storage.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
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

export function requireSceneHierarchy(
  session: DatabaseSession | undefined,
  sceneId: string
): { sequenceTitle: string; sceneTitle: string } {
  if (!session) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene hierarchy lookup requires a database session.'
    );
  }
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene hierarchy lookup requires a screenplay.'
    );
  }
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id === sceneId) {
          return {
            sequenceTitle: sequence.title ?? sequence.id ?? 'sequence',
            sceneTitle: scene.title ?? scene.id ?? 'scene',
          };
        }
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_OWNER_MISSING',
    `Scene was not found for project asset file destination: ${sceneId}.`
  );
}

export function readSceneShotVideoTakeStorageRecord(
  session: DatabaseSession,
  takeId: string
) {
  return requireSceneShotVideoTakeStorageRecord(session, takeId);
}

export function stableTakeNumber(
  session: DatabaseSession,
  sceneId: string,
  takeId: string
): string {
  const rows = listSceneShotVideoTakeStorageRecordsForScene(session, sceneId)
    .sort((left, right) =>
      left.createdAt === right.createdAt
        ? left.id.localeCompare(right.id)
        : left.createdAt.localeCompare(right.createdAt)
    );
  const index = rows.findIndex((row) => row.id === takeId);
  return String(index < 0 ? rows.length + 1 : index + 1).padStart(2, '0');
}
