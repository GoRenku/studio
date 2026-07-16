import { readAssetFileRecord } from '../database/access/asset-files.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  createSceneShotReferenceAssetRecord,
  nextSceneShotReferenceAssetSortOrder,
  readSceneShotReferenceAssetForSlot,
} from '../database/access/scene-shot-reference-assets.js';
import {
  readSceneShotListDocument,
  requireSceneShotListForScene,
} from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { ProjectDataError } from '../project-data-error.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

export function registerSceneShotGenericReferenceAsset(input: {
  session: DatabaseSession;
  sceneId: string;
  shotListId: string;
  shotId: string;
  assetId: string;
  assetFileId: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}) {
  const screenplay = readScreenplayDocumentFromSession(input.session);
  if (!screenplay) {
    throw new ProjectDataError(
      'CORE_SCENE_SHOT_REFERENCE_CONTEXT_UNAVAILABLE',
      'A screenplay is required to register a Shot generic reference.'
    );
  }
  const row = requireSceneShotListForScene(input);
  const shotList = readSceneShotListDocument({ row, screenplay });
  if (!shotList.shots.some((shot) => shot.shotId === input.shotId)) {
    throw new ProjectDataError(
      'CORE_SCENE_SHOT_REFERENCE_SHOT_NOT_FOUND',
      `Shot does not belong to the supplied Scene Shot List: ${input.shotId}.`
    );
  }
  if (!readAssetFileRecord(input.session, input)) {
    throw new ProjectDataError(
      'CORE_SCENE_SHOT_REFERENCE_ASSET_FILE_NOT_FOUND',
      'The exact registered asset file was not found or is unavailable.'
    );
  }
  if (readSceneShotReferenceAssetForSlot(input)) {
    throw new ProjectDataError(
      'CORE_SCENE_SHOT_REFERENCE_ALREADY_REGISTERED',
      'The exact asset file is already registered to this Shot.'
    );
  }
  const id = input.idGenerator.next('scene_shot_reference_asset');
  createSceneShotReferenceAssetRecord({
    ...input,
    id,
    sortOrder: nextSceneShotReferenceAssetSortOrder(input),
  });
  return {
    id,
    sceneId: input.sceneId,
    shotListId: input.shotListId,
    shotId: input.shotId,
    assetId: input.assetId,
    assetFileId: input.assetFileId,
    resourceKeys: [`scene:${input.sceneId}`],
  };
}

export function discardSceneShotGenericReferenceAsset(input: {
  session: DatabaseSession;
  projectFolder: string;
  relationshipId: string;
}) {
  const project = readProjectRecord(input.session);
  if (!project) {
    throw new ProjectDataError(
      'CORE_SCENE_SHOT_REFERENCE_CONTEXT_UNAVAILABLE',
      'Project metadata is required to discard a Shot generic reference.'
    );
  }
  return discardTrashObject({
    session: input.session,
    project,
    projectFolder: input.projectFolder,
    itemKind: 'sceneShotReferenceAsset',
    itemId: input.relationshipId,
    commandName: 'scene-shot-reference-asset.discard',
    changes: [{
      type: 'sceneShotReferenceAsset.discarded',
      relationshipId: input.relationshipId,
    }],
  });
}
