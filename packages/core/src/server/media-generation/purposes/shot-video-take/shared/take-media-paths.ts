import type {
  SceneShotVideoTake,
} from '../../../../../client/index.js';
import type {
  ScreenplayDocument,
} from '../../../../../client/screenplay.js';
import {
  listSceneShotVideoTakesForScene,
} from '../../../../database/access/scene-shot-video-takes.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  kebabCasePathSegment,
  shotVideoTakeFolder,
} from '../../../../files/asset-paths.js';
import {
  requireSceneHierarchy,
} from './project-session.js';

export function resolveShotVideoTakeFolder(input: {
  session: DatabaseSession;
  screenplay: ScreenplayDocument;
  take: SceneShotVideoTake;
}) {
  const hierarchy = requireSceneHierarchy(input.screenplay, input.take.sceneId);
  return shotVideoTakeFolder({
    sequenceTitle: hierarchy.sequence.title ?? hierarchy.sequence.id ?? 'sequence',
    sceneTitle: hierarchy.scene.title ?? hierarchy.scene.id ?? 'scene',
    takeTitle: `${kebabCasePathSegment(input.take.title, 'take')}-${sceneLocalTakeNumber(input)}`,
  });
}

function sceneLocalTakeNumber(input: {
  session: DatabaseSession;
  screenplay: ScreenplayDocument;
  take: SceneShotVideoTake;
}): string {
  const takes = listSceneShotVideoTakesForScene(input.session, {
    sceneId: input.take.sceneId,
    screenplay: input.screenplay,
  })
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const index = takes.findIndex((take) => take.takeId === input.take.takeId);
  return String(index < 0 ? takes.length + 1 : index + 1).padStart(2, '0');
}
