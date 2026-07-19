import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const castVoiceSamplePurpose = defineGenerationPurpose({
  purpose: 'cast.voice-sample', targetKind: 'castMember', outputMediaKind: 'audio', settings: noSettings,
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
