import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide, type GuideSlotDefinition } from '../purpose-guide.js';
import { characterSheetSlot, locationSheetSlot, propSheetSlot } from '../reference-slots/domain-assets.js';
import { storyboardLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';
export const sceneStoryboardSheetPurpose = defineGenerationPurpose({
  purpose: 'scene.storyboard-sheet', targetKind: 'scene', outputMediaKind: 'image',
  settings: { fixed: [{ kind: 'quality', value: 'high' }], recommended: [] },
  async buildReferenceGuide(context) {
    const slots: GuideSlotDefinition[] = [storyboardLookbookSheetSlot(context)];
    const sceneCastMemberIds = (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const sceneLocationIds = (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    const scenePropIds = (context.facts?.scenePropIds as string[] | undefined) ?? [];
    for (const id of sceneCastMemberIds) {
      slots.push(characterSheetSlot({ context, castMemberId: id }));
    }
    for (const id of sceneLocationIds) {
      slots.push(locationSheetSlot({ context, locationId: id }));
    }
    for (const id of scenePropIds) {
      slots.push(propSheetSlot({ context, propId: id }));
    }
    return buildReferenceGuide({ context, slots });
  },
});
