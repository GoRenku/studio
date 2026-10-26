import type { CastingEstimatedCost, CastingRoundKind } from '@gorenku/studio-core/client';
import { CASTING_ROUND_KIND_LABELS } from '@/features/casting-views/round-kind-labels';
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

/**
 * "Round 1 · 5 of 6 · $0.16" while images are still coming in, else "Round 1 · 6 candidates · $0.16"
 * or "Round 1 · 2 sheets · $0.18".
 */
export function roundSummary(round: CastingRoundViewResponse, kind: CastingRoundKind): string {
  const parts = [
    `Round ${round.number}`,
    round.candidates.length < round.expectedCount
      ? `${round.candidates.length} of ${round.expectedCount}`
      : countLabel(round.candidates.length, CASTING_ROUND_KIND_LABELS[kind].noun),
  ];
  if (round.estimatedCost) {
    parts.push(formatEstimatedCost(round.estimatedCost));
  }
  return parts.join(' · ');
}

function formatEstimatedCost(cost: CastingEstimatedCost): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency }).format(cost.amount);
}

/** A kept image is one that isn't hidden; the round's choice always counts as kept. */
export function isKeptCandidate(candidate: CastingCandidateView, chosenAssetFileId: string | null): boolean {
  return candidate.status !== 'hidden' || candidate.assetFileId === chosenAssetFileId;
}

/** Every kept image of some rounds, in round order. */
export function keptCandidates(rounds: CastingRoundViewResponse[], chosenAssetFileId: string | null): CastingCandidateView[] {
  return rounds.flatMap((round) => round.candidates.filter((candidate) => isKeptCandidate(candidate, chosenAssetFileId)));
}

/** How many images of some rounds are hidden from view. */
export function hiddenCount(rounds: CastingRoundViewResponse[], chosenAssetFileId: string | null): number {
  return rounds.reduce((total, round) => total + round.candidates.length, 0) - keptCandidates(rounds, chosenAssetFileId).length;
}

export function lookStatus(look: CastCastingLookResponse): LookStatus {
  if (look.castCandidateAssetFileId) {
    return { label: 'Cast', cast: true };
  }
  const kept = keptCandidates(look.rounds, null).length;
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
