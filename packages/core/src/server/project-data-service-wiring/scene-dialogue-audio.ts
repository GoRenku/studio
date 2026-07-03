import * as sceneDialogueAudio from '../media-generation/scene-dialogue-audio.js';
import * as estimation from '../media-generation/estimation/spec-estimates.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

type SceneDialogueAudioMethods = Pick<
  ProjectDataService,
  | 'readSceneDialogueAudioContext'
  | 'listSceneDialogueAudioModels'
  | 'validateSceneDialogueAudioSpec'
  | 'createSceneDialogueAudioSpec'
  | 'updateSceneDialogueAudioSpec'
  | 'listSceneDialogueAudioSpecs'
  | 'prepareSceneDialogueAudioSpec'
  | 'estimateSceneDialogueAudioDraft'
  | 'updateSceneDialogueAudioSetup'
  | 'generateSceneDialogueAudioTake'
  | 'deleteSceneDialogueAudioTake'
>;

export function createSceneDialogueAudioServiceWiring(): SceneDialogueAudioMethods {
  return {
    readSceneDialogueAudioContext: sceneDialogueAudio.readSceneDialogueAudioContext,
    listSceneDialogueAudioModels: sceneDialogueAudio.listSceneDialogueAudioModels,
    validateSceneDialogueAudioSpec: sceneDialogueAudio.validateSceneDialogueAudioSpec,
    createSceneDialogueAudioSpec: sceneDialogueAudio.createSceneDialogueAudioSpec,
    updateSceneDialogueAudioSpec: sceneDialogueAudio.updateSceneDialogueAudioSpec,
    listSceneDialogueAudioSpecs: sceneDialogueAudio.listSceneDialogueAudioSpecs,
    prepareSceneDialogueAudioSpec: sceneDialogueAudio.prepareSceneDialogueAudioSpec,
    estimateSceneDialogueAudioDraft: estimation.estimateDraftMediaGenerationSpec,
    updateSceneDialogueAudioSetup: sceneDialogueAudio.updateSceneDialogueAudioSetup,
    generateSceneDialogueAudioTake: sceneDialogueAudio.generateSceneDialogueAudioTake,
    deleteSceneDialogueAudioTake: sceneDialogueAudio.deleteSceneDialogueAudioTake,
  };
}
