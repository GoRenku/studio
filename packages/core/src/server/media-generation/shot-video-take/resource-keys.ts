import {
  PreparedSceneShotVideoTake,
} from './take-generation-context.js';



export function shotVideoTakeResourceKeys(
  prepared: PreparedSceneShotVideoTake
): string[] {
  return [
    `scene:${prepared.sceneId}`,
    `surface:scene:${prepared.sceneId}:shots`,
    `surface:scene:${prepared.sceneId}:takes`,
    `scene-shot-video-take:${prepared.take.takeId}`,
  ];
}
