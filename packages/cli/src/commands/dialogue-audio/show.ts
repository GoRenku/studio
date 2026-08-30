import { requiredFlag } from '../structured-command.js';
import type { DialogueAudioCommandInput } from './command.js';

export async function showDialogueAudio(input: DialogueAudioCommandInput) {
  return input.runtime.projectDataService.readSceneDialogueAudioWorkspace({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    sceneId: requiredFlag(input.flags.scene, '--scene'),
  });
}
