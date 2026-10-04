import type {
  AssetFileSelectionReport,
  SceneStoryboardImageCandidateInput,
} from '../../client/index.js';
import type { RecoverableMutationReport } from '../../client/trash.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { selectAssetFileInSession } from '../asset-files/selection.js';
import { readProjectRecord } from '../database/access/project.js';
import {
  readActiveSceneBeatsRevisionId,
  readSceneBeats,
  requireSceneBeatsRevisionForScene,
} from '../database/access/scene-beats.js';
import { withProject } from '../project-operation.js';
import { ProjectDataError } from '../project-data-error.js';
import { sceneBeatsResourceKeys } from './storyboard-status.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';

export async function selectSceneStoryboardImageCandidate(
  input: SceneStoryboardImageCandidateInput,
): Promise<AssetFileSelectionReport> {
  return withProject(input, ({ session, projectFolder }) => {
    validateCandidate(session, input);
    const target = { kind: 'sceneBeat' as const, sceneId: input.sceneId, beatId: input.beatId };
    selectAssetFileInSession(session, { target, assetFileId: input.assetFileId, now: new Date().toISOString() });
    const project = requireProject(session);
    return {
      valid: true,
      warnings: [],
      project: { id: project.id, projectName: project.projectName, projectFolder },
      target,
      selectedAssetFileId: input.assetFileId,
      resourceKeys: sceneBeatsResourceKeys({ ...input, beatIds: [input.beatId] }),
    };
  });
}

export async function discardSceneStoryboardImageCandidate(
  input: SceneStoryboardImageCandidateInput,
): Promise<RecoverableMutationReport> {
  return withProject(input, ({ session, projectFolder }) => {
    validateCandidate(session, input);
    const project = requireProject(session);
    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'assetFile',
      itemId: input.assetFileId,
      commandName: 'sceneBeat.storyboardImage.discard',
      changes: [{ type: 'sceneBeat.storyboardImageDiscarded', beatId: input.beatId, assetFileId: input.assetFileId }],
      resourceKeys: sceneBeatsResourceKeys({ ...input, beatIds: [input.beatId] }),
    });
  });
}

function validateCandidate(
  session: Parameters<typeof readActiveSceneBeatsRevisionId>[0],
  input: SceneStoryboardImageCandidateInput,
): void {
  if (readActiveSceneBeatsRevisionId(session, input.sceneId) !== input.sceneBeatsRevisionId) {
    throw invalidContext();
  }
  const revision = readSceneBeats({ row: requireSceneBeatsRevisionForScene({
    session,
    sceneId: input.sceneId,
    revisionId: input.sceneBeatsRevisionId,
  }) });
  if (!revision.beats.some((beat) => beat.id === input.beatId)) {
    throw invalidContext();
  }
  const assetFile = readOwnedAssetFile(session, {
    owner: { kind: 'sceneBeat', sceneId: input.sceneId, beatId: input.beatId },
    assetFileId: input.assetFileId,
  });
  if (!assetFile || assetFile.type !== 'scene_storyboard_image') {
    throw invalidContext();
  }
}

function invalidContext(): ProjectDataError {
  return new ProjectDataError(
    'CORE_SCENE_STORYBOARD_CANDIDATE_CONTEXT_INVALID',
    'The Scene Beats revision, Beat, or Storyboard image candidate is not current.',
  );
}

function requireProject(
  session: Parameters<typeof readProjectRecord>[0],
): NonNullable<ReturnType<typeof readProjectRecord>> {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
  }
  return project;
}
