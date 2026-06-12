import type { MediaGenerationDependencySlot } from '../../client/index.js';
import { castCharacterSheetDependencySlot } from './dependency-slot-definitions.js';

export function declareCastProfileDependencySlots(input: {
  castMemberId: string;
  castMemberName: string;
}): MediaGenerationDependencySlot[] {
  return [
    castCharacterSheetDependencySlot({
      castMemberId: input.castMemberId,
      castMemberName: input.castMemberName,
      required: true,
      reason:
        'A cast profile must be grounded in the selected character sheet.',
    }),
  ];
}
