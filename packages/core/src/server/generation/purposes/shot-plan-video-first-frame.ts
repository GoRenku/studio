import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import {
  characterSheetSlot,
  locationSheetSlot,
} from '../reference-slots/domain-assets.js';
import { buildShotPlanVideoReferenceGuide } from './shot-plan-video-reference-guide.js';

export const shotPlanVideoFirstFramePurpose = defineGenerationPurpose({
  purpose: 'shot-plan.video-first-frame',
  targetKind: 'project',
  outputMediaKind: 'image',
  settings: noSettings,
  async buildReferenceGuide(context) {
    return buildShotPlanVideoReferenceGuide({
      context,
      slots: contextualDesignSlots(context),
    });
  },
});

function contextualDesignSlots(
  context: Parameters<typeof characterSheetSlot>[0]['context'],
) {
  return [
    ...stringFacts(context.facts?.sceneCastMemberIds).map((castMemberId) =>
      characterSheetSlot({ context, castMemberId })
    ),
    ...stringFacts(context.facts?.sceneLocationIds).map((locationId) =>
      locationSheetSlot({ context, locationId })
    ),
  ];
}

function stringFacts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
