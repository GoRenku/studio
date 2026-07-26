import { defineGenerationPurpose } from '../purpose-factory.js';
import {
  buildReferenceGuide,
  type GuideSlotDefinition,
} from '../purpose-guide.js';
import {
  characterSheetSlot,
  locationSheetSlot,
} from '../reference-slots/domain-assets.js';
import { storyboardLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';

export const shotImagePurpose = defineGenerationPurpose({
  purpose: 'shot.image',
  targetKind: 'shot',
  outputMediaKind: 'image',
  settings: {
    fixed: [],
    recommended: [
      { kind: 'aspect-ratio', value: 'project' },
      { kind: 'quality', value: 'high' },
    ],
  },
  async buildReferenceGuide(context) {
    const slots: GuideSlotDefinition[] = [storyboardLookbookSheetSlot(context)];
    const castMemberIds =
      (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const locationIds =
      (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    for (const castMemberId of castMemberIds) {
      slots.push(characterSheetSlot({ context, castMemberId }));
    }
    for (const locationId of locationIds) {
      slots.push(locationSheetSlot({ context, locationId }));
    }
    return buildReferenceGuide({ context, slots });
  },
});
