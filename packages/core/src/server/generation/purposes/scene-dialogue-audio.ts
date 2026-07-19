import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const sceneDialogueAudioPurpose = defineGenerationPurpose({
  purpose: 'scene.dialogue-audio', targetKind: 'sceneDialogue', outputMediaKind: 'audio', settings: noSettings,
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
