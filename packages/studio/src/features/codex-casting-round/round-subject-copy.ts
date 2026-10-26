import type { CastingRound } from '@gorenku/studio-codex/casting-round';

/** The panel's words for each subject: one Look's casting candidates, or character sheets for costumes. */
export const ROUND_SUBJECT_COPY: Record<CastingRound['subject']['kind'], {
  title: string;
  countLabel: string;
  briefTitle: string;
  noun: string;
  defaultsName: string;
}> = {
  look: { title: 'Casting round', countLabel: 'Candidates', briefTitle: 'What each candidate shows', noun: 'candidate', defaultsName: 'casting' },
  costumes: { title: 'Character sheet round', countLabel: 'Sheets per costume', briefTitle: 'What each sheet shows', noun: 'sheet', defaultsName: 'character sheet' },
};

/** "Ana Komnene · Older": the Cast Member and the Look the round is for. */
export function roundSubjectLine(round: CastingRound): string {
  return `${round.castMember.name} · ${round.subject.look.name}`;
}

/** How many rounds one answer creates: one per ticked costume, or one for a Look. */
export function roundCount(round: CastingRound, tickedCostumeIds: string[]): number {
  return round.subject.kind === 'costumes' ? tickedCostumeIds.length : 1;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
