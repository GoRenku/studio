import { defineGenerationPurpose, noSettings } from '../purpose-factory.js';
import {
  characterSheetSlot,
  locationSheetSlot,
} from '../reference-slots/domain-assets.js';
import { buildShotPlanVideoReferenceGuide } from './shot-plan-video-reference-guide.js';

export const shotPlanVideoLastFramePurpose = defineGenerationPurpose({
  purpose: 'shot-plan.video-last-frame',
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
