/** Presentation-only speaker colours: a fixed palette picked by a stable hash of the Cast Member id. */
const SPEAKER_PALETTE: ReadonlyArray<{ hue: number; avatar: string }> = [
  { hue: 18, avatar: 'hsl(18 55% 42%)' },
  { hue: 262, avatar: 'hsl(262 30% 46%)' },
  { hue: 170, avatar: 'hsl(170 35% 34%)' },
  { hue: 212, avatar: 'hsl(212 38% 44%)' },
  { hue: 330, avatar: 'hsl(330 32% 44%)' },
  { hue: 42, avatar: 'hsl(42 48% 38%)' },
  { hue: 120, avatar: 'hsl(120 26% 36%)' },
  { hue: 190, avatar: 'hsl(190 40% 36%)' },
];

export function speakerHue(castMemberId: string | null, speakerName: string): number {
  const seed = castMemberId ?? speakerName;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) | 0;
  return SPEAKER_PALETTE[Math.abs(hash) % SPEAKER_PALETTE.length]!.hue;
}

export function speakerAvatarColour(hue: number): string {
  return SPEAKER_PALETTE.find((entry) => entry.hue === hue)?.avatar ?? `hsl(${hue} 40% 40%)`;
}

export function speakerTextColour(hue: number): string {
  return `hsl(${hue} 50% var(--dd-spk-l))`;
}

export function speakerInitials(speakerName: string): string {
  const words = speakerName.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join('');
}
