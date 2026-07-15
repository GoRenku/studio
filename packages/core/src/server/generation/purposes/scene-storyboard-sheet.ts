import { defineGenerationPurpose } from '../purpose-factory.js';
import { buildReferenceGuide, type GuideSlotDefinition } from '../purpose-guide.js';
import { characterSheetSlot, locationSheetSlot } from '../reference-slots/domain-assets.js';
import { storyboardLookbookSheetSlot } from '../reference-slots/lookbook-sheets.js';
export const sceneStoryboardSheetPurpose = defineGenerationPurpose({
  purpose: 'scene.storyboard-sheet', targetKind: 'scene', outputMediaKind: 'image', modelUse: 'any',
  settings: { fixed: [{ kind: 'aspect-ratio', value: '4:3' }, { kind: 'quality', value: 'high' }], recommended: [], recommendedModel: { provider: 'fal-ai', model: 'openai/gpt-image-2' } },
  async buildReferenceGuide(context) {
    const slots: GuideSlotDefinition[] = [storyboardLookbookSheetSlot(context)];
    const sceneCastMemberIds = (context.facts?.sceneCastMemberIds as string[] | undefined) ?? [];
    const sceneLocationIds = (context.facts?.sceneLocationIds as string[] | undefined) ?? [];
    for (const id of sceneCastMemberIds) {
      slots.push(characterSheetSlot({ context, castMemberId: id }));
    }
    for (const id of sceneLocationIds) {
      slots.push(locationSheetSlot({ context, locationId: id }));
    }
    const guide = buildReferenceGuide({ context, slots });
    if (guide.sections[0]?.slots[0]?.candidates.length === 0) {
      guide.notices.push({ code: 'CORE_GENERATION_STORYBOARD_LOOKBOOK_RECOMMENDED', message: 'No Storyboard Lookbook Sheet is available.', suggestion: 'Create a Storyboard Lookbook Sheet for consistent storyboard generations.' });
    }
    return guide;
  },
});
