import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { productionLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';
export const lookbookImagePurpose = defineGenerationPurpose({
  purpose: 'lookbook.image', targetKind: 'lookbook', outputMediaKind: 'image',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: 'project' }, { kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({ context, slots: [productionLookbookSheetSlot(context)] });
  },
});
