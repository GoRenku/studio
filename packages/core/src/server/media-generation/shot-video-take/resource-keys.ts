import {
  PreparedSceneShotVideoTakeGeneration,
} from './take-generation-context.js';



export function shotVideoTakeResourceKeys(
  prepared: PreparedSceneShotVideoTakeGeneration
): string[] {
  return [
    `scene:${prepared.sceneId}`,
    `surface:scene:${prepared.sceneId}:shots`,
    `surface:scene:${prepared.sceneId}:takes`,
    `scene-shot-video-take-generation:${prepared.takeGeneration.takeGenerationId}`,
  ];
}
