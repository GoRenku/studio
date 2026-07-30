import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import {
  characterSheetSlot,
  locationSheetSlot,
} from '../reference-slots/domain-assets.js';
import {
  shotPlanDialogueAudioSlots,
  shotPlanLookbookSlot,
  shotPlanVideoMethodSlots,
} from '../reference-slots/shot-plan-video-references.js';
import { buildShotPlanVideoReferenceGuide } from './shot-plan-video-reference-guide.js';

export const shotPlanVideoGenerationPurpose = defineGenerationPurpose({
  purpose: 'shot-plan.video-generation',
  targetKind: 'project',
  outputMediaKind: 'video',
  settings: noSettings,
  async buildReferenceGuide(context) {
    const slots = [...shotPlanVideoMethodSlots(context)];
    for (const castMemberId of stringFacts(context.facts?.sceneCastMemberIds)) {
      slots.push(characterSheetSlot({ context, castMemberId }));
    }
    for (const locationId of stringFacts(context.facts?.sceneLocationIds)) {
      slots.push(locationSheetSlot({ context, locationId }));
    }
    slots.push(...shotPlanDialogueAudioSlots(context));
    slots.push(shotPlanLookbookSlot(context));
    return buildShotPlanVideoReferenceGuide({
      context,
      slots,
    });
  },
});

function stringFacts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
