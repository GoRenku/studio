/** Colour families that tie a Look's card to its band in the scene strip. */
export type CastingTone = 'lookA' | 'lookB' | 'lookC' | 'lookD' | 'lookE' | 'costume';

export type CastingLookTone = Exclude<CastingTone, 'costume'>;

const LOOK_TONES: CastingLookTone[] = ['lookA', 'lookB', 'lookC', 'lookD', 'lookE'];

export const CASTING_TONE_CLASS_NAMES: Record<CastingTone, string> = {
  lookA: 'bg-sky-600/85 text-white',
  lookB: 'bg-amber-600/85 text-white',
  lookC: 'bg-violet-600/80 text-white',
  lookD: 'bg-teal-600/85 text-white',
  lookE: 'bg-rose-600/80 text-white',
  costume: 'border-[1.5px] border-border bg-transparent text-foreground',
};

/** Looks take the tones in order and repeat after the fifth. */
export function castingLookTone(lookIndex: number): CastingLookTone {
  return LOOK_TONES[lookIndex % LOOK_TONES.length]!;
}
