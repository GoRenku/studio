import type { CharacterArcSpineKey, CharacterArcType } from '@gorenku/studio-core/client';

export const ARC_TYPE_LABELS: Record<CharacterArcType, string> = {
  positiveChange: 'Grows',
  flat: 'Holds firm',
  disillusionment: 'Disillusioned',
  fall: 'Falls',
  corruption: 'Corrupted',
};

export const ARC_TYPE_HINTS: Record<CharacterArcType, string> = {
  positiveChange: 'Lets go of a false belief and ends in a better place.',
  flat: 'Already holds a truth, is tested, and changes the people around them.',
  disillusionment: 'Reaches the truth, but at a painful cost.',
  fall: 'Holds on to a false belief and ends worse off.',
  corruption: 'Trades a truth for a false belief.',
};

export const SPINE_LABELS: Record<CharacterArcSpineKey, string> = {
  want: 'Wants',
  need: 'Needs',
  falseBelief: 'False belief',
  wound: 'Old wound',
  truthHeld: 'Truth they hold',
  testedBy: 'Tested by',
  changesOthers: 'Changes others',
};

/** Which spine fields an arc type shows, in order. */
export const SPINE_ORDER: Record<CharacterArcType, CharacterArcSpineKey[]> = {
  positiveChange: ['want', 'need', 'falseBelief', 'wound'],
  flat: ['want', 'truthHeld', 'testedBy', 'changesOthers'],
  disillusionment: ['want', 'need', 'falseBelief', 'wound'],
  fall: ['want', 'need', 'falseBelief', 'wound'],
  corruption: ['want', 'need', 'falseBelief', 'wound'],
};
