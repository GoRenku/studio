import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const castStoryboardCharacterSheetPurpose = defineGenerationPurpose({
  purpose: 'cast.storyboard-character-sheet', targetKind: 'castMember', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: '16:9' }, { kind: 'quality', value: 'high' }], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
