import type { BuildGenerationPurposeInput } from '../purpose-contract.js';
import type { GuideSlotDefinition } from '../purpose-guide.js';

export function characterSheetSlot(input: {
  context: BuildGenerationPurposeInput;
  castMemberId: string;
}): GuideSlotDefinition {
  return {
    sectionId: 'cast',
    sectionLabel: 'Cast',
    slotId: 'character-sheet',
    slotLabel: 'Character Sheet',
    subject: { kind: 'castMember', id: input.castMemberId },
    owner: { kind: 'castMember', id: input.castMemberId },
    roles: ['character-sheet'],
  };
}

export function locationSheetSlot(input: {
  context: BuildGenerationPurposeInput;
  locationId: string;
}): GuideSlotDefinition {
  return {
    sectionId: 'location',
    sectionLabel: 'Location',
    slotId: 'location-sheet',
    slotLabel: 'Location Sheet',
    subject: { kind: 'location', id: input.locationId },
    owner: { kind: 'location', id: input.locationId },
    roles: ['location-sheet', 'environment-sheet'],
  };
}
