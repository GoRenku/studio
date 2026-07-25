import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';

export const videoCreatePurpose = defineGenerationPurpose({
  purpose: 'video.create',
  targetKind: 'project',
  outputMediaKind: 'video',
  settings: {
    fixed: [],
    recommended: [{ kind: 'aspect-ratio', value: 'project' }],
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({ context });
  },
});
