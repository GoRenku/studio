import {
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  type SceneDialogueAudioGenerationSpec,
} from '../../../../client/index.js';
import { buildMediaGenerationCostProjection } from '../../cost/cost-projection.js';
import * as sceneDialogueAudio from '../../purposes/scene-dialogue-audio.js';
import type { MediaGenerationPurposeDefinition } from '../purpose-definition.js';
import { requireTargetKind } from '../purpose-targets.js';

function toDialogueInput(input: Parameters<MediaGenerationPurposeDefinition['buildContext']>[0]) {
  const target = requireTargetKind(input, 'sceneDialogue');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.sceneId,
    dialogueId: target.dialogueId,
  };
}

export const sceneDialogueAudioPurposeDefinition = {
  purpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  mediaKind: 'audio',
  targetKind: 'sceneDialogue',
  buildCostProjection: buildMediaGenerationCostProjection,
  buildContext: (input) => sceneDialogueAudio.readSceneDialogueAudioContext(toDialogueInput(input)),
  listModels: (input) => sceneDialogueAudio.listSceneDialogueAudioModels(toDialogueInput(input)),
  validateSpec: (input) => sceneDialogueAudio.validateSceneDialogueAudioSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneDialogueAudioGenerationSpec,
  }),
  createSpec: (input) => sceneDialogueAudio.createSceneDialogueAudioSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneDialogueAudioGenerationSpec,
    idGenerator: input.idGenerator,
  }),
  updateSpec: (input) => sceneDialogueAudio.updateSceneDialogueAudioSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    specId: input.specId,
    spec: input.spec as SceneDialogueAudioGenerationSpec,
  }),
  listSpecs: (input) => sceneDialogueAudio.listSceneDialogueAudioSpecs(toDialogueInput(input)),
  prepareSpec: sceneDialogueAudio.prepareSceneDialogueAudioSpec,
  prepareDraftSpec: (input) => sceneDialogueAudio.prepareSceneDialogueAudioDraftSpec({
    projectName: input.projectName,
    homeDir: input.homeDir,
    spec: input.spec as SceneDialogueAudioGenerationSpec,
  }),
  planDependencyDraft: sceneDialogueAudio.buildSceneDialogueAudioDependencyDraftSpec,
  runSpec: sceneDialogueAudio.runSceneDialogueAudioSpec,
} satisfies MediaGenerationPurposeDefinition;
