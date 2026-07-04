import {
  PreparedSceneShotVideoTake,
} from '../authoring/take-context.js';



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
  inputIds?: string[];
  assetIds?: string[];
}): string[] {
  return [
    `scene:${input.sceneId}`,
    `surface:scene:${input.sceneId}:takes`,
    `scene-shot-video-take:${input.takeId}`,
    `scene-shot-video-take-video:${input.takeId}`,
    `scene-shot-video-take-prompt:${input.takeId}`,
    ...(input.inputIds ?? []).map((inputId) => `scene-shot-video-take-input:${inputId}`),
    ...(input.assetIds ?? []).map((assetId) => `asset:${assetId}`),
  ];
}
