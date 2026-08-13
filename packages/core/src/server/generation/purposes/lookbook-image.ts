import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { requireLookbookRecordById } from '../../database/access/lookbook.js';
import { lookbookStyleReferenceSlot } from '../reference-slots/lookbook-images.js';
import {
  productionLookbookSheetSlot,
  storyboardLookbookSheetSlot,
} from '../reference-slots/lookbook-sheets.js';
export const lookbookImagePurpose = defineGenerationPurpose({
  purpose: 'lookbook.image', targetKind: 'lookbook', outputMediaKind: 'image',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: 'project' }, { kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) {
    const lookbook = requireLookbookRecordById(context.session, context.target.id);
    const sheetSlot = lookbook.kind === 'production'
      ? productionLookbookSheetSlot(context)
      : storyboardLookbookSheetSlot(context);
    return buildReferenceGuide({
      context,
      slots: [
        lookbookStyleReferenceSlot({ context, lookbookId: lookbook.id }),
        sheetSlot,
      ],
    });
  },
});
