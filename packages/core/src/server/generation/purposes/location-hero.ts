import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';
export const locationHeroPurpose = defineGenerationPurpose({
  purpose: 'location.hero', targetKind: 'location', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '16:9' }], recommended: [{ kind: 'quality', value: 'medium' }], recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' } },
  async buildReferenceGuide(context) { return buildReferenceGuide({ context, slots: [{ sectionId: 'source', sectionLabel: 'Source', slotId: 'location-sheet', slotLabel: 'Location Sheet', cardinality: 'one', owner: { kind: 'location', id: context.target.id }, roles: ['location-sheet', 'environment-sheet'], initializeFirst: true }] }); },
});
