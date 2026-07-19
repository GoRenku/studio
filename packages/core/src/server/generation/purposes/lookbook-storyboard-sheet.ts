import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const lookbookStoryboardSheetPurpose = defineGenerationPurpose({
  purpose: 'lookbook.storyboard-sheet', targetKind: 'lookbook', outputMediaKind: 'image',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: '4:3' }, { kind: 'quality', value: 'high' }], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
