import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { readLocationRecord } from '../../database/access/locations.js';
import { readPropRecord } from '../../database/access/props.js';
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
    slotLabel:
      readCastMemberRecord(input.context.session, input.castMemberId)?.name ??
      'Character',
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
    slotLabel:
      readLocationRecord(input.context.session, input.locationId)?.name ??
      'Location',
    subject: { kind: 'location', id: input.locationId },
    owner: { kind: 'location', id: input.locationId },
    roles: ['location-sheet'],
  };
}

export function propSheetSlot(input: {
  context: BuildGenerationPurposeInput;
  propId: string;
}): GuideSlotDefinition {
  return {
    sectionId: 'prop',
    sectionLabel: 'Prop',
    slotId: 'prop-sheet',
    slotLabel: readPropRecord(input.context.session, input.propId)?.name ?? 'Prop',
    subject: { kind: 'prop', id: input.propId },
    owner: { kind: 'prop', id: input.propId },
    roles: ['prop-sheet'],
  };
}
