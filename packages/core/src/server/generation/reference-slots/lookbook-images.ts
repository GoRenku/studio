import { listLookbookImages } from '../../database/access/lookbook-images.js';
import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import type { GuideSlotDefinition } from '../purpose-guide.js';

export function lookbookStyleReferenceSlot(input: {
  context: BuildGenerationPurposeInput;
  lookbookId: string;
}): GuideSlotDefinition {
  return {
    sectionId: 'visual-language',
    sectionLabel: 'Visual Language',
    slotId: 'lookbook-style-reference',
    slotLabel: 'Lookbook Style Reference',
    guidance: 'Use an accepted image from this Lookbook to preserve visual style across examples.',
    owner: { kind: 'lookbook', id: input.lookbookId },
    assetFileIds: listLookbookImages(input.context.session, input.lookbookId)
      .flatMap((image) => image.asset.files.map((file) => file.id)),
  };
}
