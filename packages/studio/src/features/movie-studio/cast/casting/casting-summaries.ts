import type { CastingEstimatedCost } from '@gorenku/studio-core/client';
import type {
  CastCastingLookResponse,
  CastingRoundViewResponse,
} from '@/services/studio-project-contracts';

type CastingCandidateView = CastingRoundViewResponse['candidates'][number];

/** The one status a Look card shows. */
export interface LookStatus {
  label: string;
  cast: boolean;
}

/** "Round 1 · 5 of 6 · $0.16" while candidates are still coming in, else "Round 1 · 6 candidates · $0.16". */
export function roundSummary(round: CastingRoundViewResponse): string {
  const parts = [
    `Round ${round.number}`,
    round.candidates.length < round.expectedCount
      ? `${round.candidates.length} of ${round.expectedCount}`
      : countLabel(round.candidates.length, 'candidate'),
  ];
  if (round.estimatedCost) {
    parts.push(formatEstimatedCost(round.estimatedCost));
  }
  return parts.join(' · ');
}

function formatEstimatedCost(cost: CastingEstimatedCost): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency }).format(cost.amount);
}

/** A kept candidate is one that isn't hidden; the cast candidate always counts as kept. */
export function isKeptCandidate(candidate: CastingCandidateView, castAssetFileId: string | null): boolean {
  return candidate.status !== 'hidden' || candidate.assetFileId === castAssetFileId;
}

/** Every kept candidate of a Look, in round order. */
export function lookKept(look: CastCastingLookResponse): CastingCandidateView[] {
  return look.rounds.flatMap((round) => round.candidates.filter((candidate) => isKeptCandidate(candidate, look.castCandidateAssetFileId)));
}

/** How many of a Look's candidates are hidden from view. */
export function lookHiddenCount(look: CastCastingLookResponse): number {
  return look.rounds.reduce((total, round) => total + round.candidates.length, 0) - lookKept(look).length;
}

export function lookStatus(look: CastCastingLookResponse): LookStatus {
  if (look.castCandidateAssetFileId) {
    return { label: 'Cast', cast: true };
  }
  const kept = lookKept(look).length;
  if (kept > 0) {
    return { label: countLabel(kept, 'candidate'), cast: false };
  }
  return { label: 'Not cast', cast: false };
}

/** The Look the tab opens on: the first with a casting round, else the first. */
export function defaultPickedLook(looks: CastCastingLookResponse[]): CastCastingLookResponse | undefined {
  return looks.find((look) => look.rounds.length > 0) ?? looks[0];
}

export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
