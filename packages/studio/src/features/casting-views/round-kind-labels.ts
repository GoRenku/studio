import type { CastingRoundKind } from '@gorenku/studio-core/client';

/** The words and image shape of each kind of round: faces are cast, sheets are picked. */
export interface CastingRoundKindLabels {
  /** The button that makes an image the round's choice. */
  choose: string;
  /** The mark on the chosen image. */
  chosen: string;
  /** "Casting candidate" / "Character sheet", for image names. */
  imageName: string;
  /** "candidate" / "sheet", for counts. */
  noun: string;
  aspectClassName: string;
}

export const CASTING_ROUND_KIND_LABELS: Record<CastingRoundKind, CastingRoundKindLabels> = {
  candidates: { choose: 'Cast', chosen: 'Cast', imageName: 'Casting candidate', noun: 'candidate', aspectClassName: 'aspect-[4/3]' },
  characterSheets: { choose: 'Pick', chosen: 'Picked', imageName: 'Character sheet', noun: 'sheet', aspectClassName: 'aspect-video' },
};
