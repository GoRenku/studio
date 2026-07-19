import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { locationSheetSlot } from '../reference-slots/domain-assets.js';
export const locationHeroPurpose = defineGenerationPurpose({
  purpose: 'location.hero', targetKind: 'location', outputMediaKind: 'image',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '16:9' }], recommended: [{ kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [locationSheetSlot({ context, locationId: context.target.id })],
    });
  },
});
