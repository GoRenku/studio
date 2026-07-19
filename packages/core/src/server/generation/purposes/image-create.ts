import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import { buildReferenceGuide } from '../purpose-guide.js';

export const imageCreatePurpose = defineGenerationPurpose({
  purpose: 'image.create', targetKind: 'project', outputMediaKind: 'image', settings: noSettings,
  async buildReferenceGuide(context) { return buildReferenceGuide({ context }); },
});
