import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';

export const imageEditPurpose = defineGenerationPurpose({
  purpose: 'image.edit', targetKind: 'asset', outputMediaKind: 'image', modelUse: 'edit', settings: noSettings,
  async buildReferenceGuide(context) {
    return buildReferenceGuide({ context, slots: [
      { sectionId: 'source', sectionLabel: 'Source', slotId: 'source-image', slotLabel: 'Source Image', assetId: context.target.id },
    ] });
  },
});
