import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const lookbookImagePurpose = defineGenerationPurpose({
  purpose: 'lookbook.image', targetKind: 'lookbook', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: 'project' }, { kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
