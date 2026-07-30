import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import {
  characterSheetSlot,
  locationSheetSlot,
} from '../reference-slots/domain-assets.js';
import { shotPlanImageSlots } from '../reference-slots/shot-plan-video-references.js';
import { buildShotPlanVideoReferenceGuide } from './shot-plan-video-reference-guide.js';

export const shotPlanVideoStoryboardPurpose = defineGenerationPurpose({
  purpose: 'shot-plan.video-storyboard',
  targetKind: 'project',
  outputMediaKind: 'image',
  settings: noSettings,
  async buildReferenceGuide(context) {
    const slots = [
      ...stringFacts(context.facts?.sceneCastMemberIds).map((castMemberId) =>
        characterSheetSlot({ context, castMemberId })
      ),
      ...stringFacts(context.facts?.sceneLocationIds).map((locationId) =>
        locationSheetSlot({ context, locationId })
      ),
      ...shotPlanImageSlots(context),
    ];
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
