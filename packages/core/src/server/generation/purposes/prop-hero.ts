import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { propSheetSlot } from '../reference-slots/domain-assets.js';

export const propHeroPurpose = defineGenerationPurpose({
  purpose: 'prop.hero',
  targetKind: 'prop',
  outputMediaKind: 'image',
  settings: {
    fixed: [{ kind: 'aspect-ratio', value: '16:9' }],
    recommended: [{ kind: 'quality', value: 'medium' }],
    recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' },
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [propSheetSlot({ context, propId: context.target.id })],
    });
  },
});
