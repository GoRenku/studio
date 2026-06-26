import {
  PreparedSceneShotVideoTake,
} from './take-context.js';



export function shotVideoTakeResourceKeys(
  prepared: PreparedSceneShotVideoTake
): string[] {
  return sceneShotVideoTakeResourceKeys({
    sceneId: prepared.sceneId,
    takeId: prepared.take.takeId,
  });
}

export function sceneShotVideoTakeResourceKeys(input: {
  sceneId: string;
  takeId: string;
}): string[] {
  return [
    `scene:${input.sceneId}`,
    `surface:scene:${input.sceneId}:shots`,
    `surface:scene:${input.sceneId}:takes`,
    `scene-shot-video-take:${input.takeId}`,
  ];
}
