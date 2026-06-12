import {
  PreparedShotGroup,
} from './shot-group.js';



export function shotVideoTakeResourceKeys(prepared: PreparedShotGroup): string[] {
  return [
    `scene:${prepared.sceneId}`,
    `surface:scene:${prepared.sceneId}:shots`,
    `scene-shot-list:${prepared.shotListId}:video-take-production`,
    `scene-shot-video-take-group:${prepared.productionGroup.productionGroupId}`,
  ];
}
