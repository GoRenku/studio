import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const castProfilePurpose = defineGenerationPurpose({
  purpose: 'cast.profile', targetKind: 'castMember', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '1:1' }], recommended: [{ kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) { return buildReferenceGuide({ context, slots: [{ sectionId: 'source', sectionLabel: 'Source', slotId: 'video-character-sheet', slotLabel: 'Video Character Sheet', cardinality: 'one', owner: { kind: 'castMember', id: context.target.id }, roles: ['video-character-sheet', 'character-sheet'], initializeFirst: true }] }); },
});
