import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';

export const projectCoverPurpose = defineGenerationPurpose({
  purpose: 'project.cover',
  targetKind: 'project',
  outputMediaKind: 'image',
  settings: {
    fixed: [{ kind: 'aspect-ratio', value: '16:9' }],
    recommended: [{ kind: 'quality', value: 'medium' }],
    recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' },
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({ context });
  },
});
