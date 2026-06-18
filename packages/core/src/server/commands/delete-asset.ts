import fs from 'node:fs/promises';
import path from 'node:path';
import type { Asset, AssetTarget } from '../../client/index.js';
import { deleteAssetFileRecordsForAsset } from '../database/access/asset-files.js';
import { deleteAssetRecord } from '../database/access/assets.js';
import {
  deleteAssetRelationshipRecord,
  readAssetOwnerTargets,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { deleteLocationEnvironmentSheetByAssetId } from '../database/access/location-environment-sheets.js';
import { deleteSceneShotStoryboardImageByAssetId } from '../database/access/scene-shot-lists.js';
import {
  assertAssetNotReferencedByShotVideoTakeRecords,
} from '../database/access/shot-video-takes.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assertAssetIsNotCastVoiceSample } from './cast-voice-commands.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export async function deleteAsset(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
  } & RenkuConfigPathOptions
): Promise<void> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    assertAssetNotReferencedByShotVideoTakeRecords(session, input.assetId);
    const asset = readAssetRelationship(session, {
      target: input.target,
      assetId: input.assetId,
    });
    if (!asset) {
      throw assetNotAttached(input.assetId);
    }
    assertAssetIsNotCastVoiceSample(session, input.assetId);

    const otherOwners = readAssetOwnerTargets(session, input.assetId).filter(
      (owner) => !assetTargetsMatch(owner, input.target)
    );
    if (otherOwners.length > 0) {
      throw new ProjectDataError(
        'PROJECT_DATA110',
        `Asset ${input.assetId} is attached to another target and cannot be deleted from only this target.`
      );
    }

    await deleteAssetFiles(projectFolder, asset);
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      deleteAssetRelationshipRecord(txSession, {
        target: input.target,
        assetId: input.assetId,
      });
      deleteLocationEnvironmentSheetByAssetId(txSession, input.assetId);
      deleteSceneShotStoryboardImageByAssetId(txSession, input.assetId);
      deleteAssetFileRecordsForAsset(txSession, input.assetId);
      deleteAssetRecord(txSession, input.assetId);
    });
  } finally {
    session.close();
  }
}

async function deleteAssetFiles(
  projectFolder: string,
  asset: Asset
): Promise<void> {
  for (const file of asset.files) {
    const projectRelativePath = normalizeProjectRelativePath(
      file.projectRelativePath
    );
    const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    await fs.rm(absolutePath, { force: true });
  }
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA111',
      `Asset file must be inside the project folder: ${absolutePath}.`
    );
  }
}

function assetTargetsMatch(left: AssetTarget, right: AssetTarget): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case 'project':
      return true;
    case 'castMember':
      return (
        right.kind === 'castMember' &&
        left.castMemberId === right.castMemberId
      );
    case 'location':
      return right.kind === 'location' && left.locationId === right.locationId;
    case 'sequence':
      return right.kind === 'sequence' && left.sequenceId === right.sequenceId;
    case 'scene':
      return right.kind === 'scene' && left.sceneId === right.sceneId;
  }
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
