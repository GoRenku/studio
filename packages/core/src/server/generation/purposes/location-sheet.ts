import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { locationSheetSlot } from '../reference-slots/domain-assets.js';
import { productionLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';
export const locationSheetPurpose = defineGenerationPurpose({
  purpose: 'location.sheet', targetKind: 'location', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: '16:9' }, { kind: 'quality', value: 'high' }], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [
        productionLookbookSheetSlot(context),
        locationSheetSlot({ context, locationId: context.target.id }),
      ],
    });
  },
});
