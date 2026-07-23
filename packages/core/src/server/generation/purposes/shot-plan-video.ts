import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide, type GuideSlotDefinition } from '../purpose-guide.js';
import { characterSheetSlot, locationSheetSlot } from '../reference-slots/domain-assets.js';
import {
  productionLookbookSheetSlot,
  storyboardLookbookSheetSlot,
} from '../reference-slots/lookbook-sheets.js';
import { shotPlanVideoInputSlots } from '../reference-slots/shot-plan-video.js';

export const shotPlanVideoPurpose = defineGenerationPurpose({
  purpose: 'shot-plan.video',
  targetKind: 'shotPlan',
  outputMediaKind: 'video',
  settings: {
    fixed: [],
    recommended: [{ kind: 'aspect-ratio', value: 'project' }],
  },
  async buildReferenceGuide(context) {
    const slots: GuideSlotDefinition[] = [
      productionLookbookSheetSlot(context),
      storyboardLookbookSheetSlot(context),
    ];
    const castMemberIds =
      (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const locationIds =
      (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    castMemberIds.forEach((castMemberId) => {
      slots.push(characterSheetSlot({ context, castMemberId }));
    });
    locationIds.forEach((locationId) => {
      slots.push(locationSheetSlot({ context, locationId }));
    });
    slots.push(...shotPlanVideoInputSlots(context));
    return buildReferenceGuide({ context, slots });
  },
});
