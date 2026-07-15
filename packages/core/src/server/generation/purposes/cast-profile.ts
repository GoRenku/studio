import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
import { characterSheetSlot } from '../reference-slots/domain-assets.js';
export const castProfilePurpose = defineGenerationPurpose({
  purpose: 'cast.profile', targetKind: 'castMember', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '1:1' }], recommended: [{ kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({
      context,
      slots: [characterSheetSlot({ context, castMemberId: context.target.id })],
    });
  },
});
