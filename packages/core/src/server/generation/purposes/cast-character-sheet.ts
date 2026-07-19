import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { characterSheetSlot } from '../reference-slots/domain-assets.js';
import { productionLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';
export const castCharacterSheetPurpose = defineGenerationPurpose({
  purpose: 'cast.character-sheet', targetKind: 'castMember', outputMediaKind: 'image',
  settings: { fixed: [], recommended: [{ kind: 'aspect-ratio', value: '16:9' }, { kind: 'quality', value: 'high' }], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [
        productionLookbookSheetSlot(context),
        characterSheetSlot({ context, castMemberId: context.target.id }),
      ],
    });
  },
});
