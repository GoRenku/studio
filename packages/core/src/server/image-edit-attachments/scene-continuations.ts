import { allocateSceneStoryboardIterationFolderSync } from '../project-asset-files/index.js';
import { readActiveSceneBeatsRevisionRecord, readSceneBeats } from '../database/access/scene-beats.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { requireShotRecord } from '../database/access/shot-plans/shot-records.js';
import { ProjectDataError } from '../project-data-error.js';
import {
  studioSceneBeatsResourceKey,
  studioSceneShotPlansResourceKey,
} from '../studio-coordination/resource-keys.js';
import type {
  ImageEditContinuation,
  ImageEditContinuationInput,
} from './continuation-registry.js';

export function resolveSceneImageEditContinuation(
  input: ImageEditContinuationInput,
): ImageEditContinuation | null {
  const { source, session, projectFolder } = input;
  if (source.type === 'shot_image') {
    if (source.owner.kind !== 'shot') {
      throw new ProjectDataError(
        'CORE_IMAGE_EDIT_OWNER_INVALID',
        `Asset ${source.id} has ownership that is invalid for ${source.type}.`,
      );
    }
    const shot = requireShotRecord(session, source.owner.id);
    const shotPlan = requireShotPlanRecord(session, shot.shotPlanId);
    return {
      owner: source.owner,
      assetType: source.type,
      destination: { kind: 'shot.image', shotPlanId: shotPlan.id, shotId: shot.id },
      fileRole: 'primary',
      resourceKeys: [studioSceneShotPlansResourceKey(shotPlan.sceneId)],
    };
  }
  if (source.type !== 'scene_storyboard_image') {
    return null;
  }
  if (source.owner.kind !== 'sceneBeat') {
    throw unavailable();
  }
  const owner = source.owner;
  const active = readActiveSceneBeatsRevisionRecord(session, owner.sceneId);
  const beat = active
    ? readSceneBeats({ row: active }).beats.find((candidate) => candidate.id === owner.beatId)
    : null;
  if (!beat) {
    throw unavailable();
  }
  return {
    owner,
    assetType: source.type,
    destination: {
      kind: 'scene.storyboardImage',
      sceneId: owner.sceneId,
      iterationFolder: allocateSceneStoryboardIterationFolderSync({
        session,
        projectFolder,
        sceneId: owner.sceneId,
      }),
      beatNumber: beat.number,
    },
    fileRole: 'storyboard_image',
    resourceKeys: [studioSceneBeatsResourceKey(owner.sceneId)],
  };
}

function unavailable(): ProjectDataError {
  return new ProjectDataError(
    'CORE_IMAGE_EDIT_SURFACE_UNAVAILABLE',
    'The source Storyboard image does not belong to a Beat in the active Scene Beats revision.',
  );
}
