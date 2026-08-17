import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { propSheetSlot } from '../reference-slots/domain-assets.js';
import { productionLookbookSheetSlot, storyboardLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';

export const propSheetPurpose = defineGenerationPurpose({
  purpose: 'prop.sheet',
  targetKind: 'prop',
  outputMediaKind: 'image',
  settings: {
    fixed: [],
    recommended: [
      { kind: 'aspect-ratio', value: '16:9' },
      { kind: 'quality', value: 'high' },
    ],
    recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [
        productionLookbookSheetSlot(context),
        storyboardLookbookSheetSlot(context),
        propSheetSlot({ context, propId: context.target.id }),
      ],
    });
  },
});
