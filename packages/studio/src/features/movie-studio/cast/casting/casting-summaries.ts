import type { CastingEstimatedCost } from '@gorenku/studio-core/client';
import type { SceneStripBand } from '@/features/casting-views/scene-strip';
import { castingLookTone } from '@/features/casting-views/casting-tones';
import type {
  CastCastingLookResponse,
  CastCastingResourceResponse,
  CastingRoundViewResponse,
} from '@/services/studio-project-contracts';

export function wardrobeBands(resource: CastCastingResourceResponse): SceneStripBand[] {
  const bands: SceneStripBand[] = [{
    label: 'Look',
    rows: resource.looks.map((look, index) => ({
      sceneIds: look.sceneIds,
      name: look.name,
      tone: castingLookTone(index),
    })),
  }];
  if (resource.costumes.length > 0) {
    bands.push({
      label: 'Costume',
      rows: resource.costumes.map((costume) => ({
        sceneIds: costume.sceneIds,
        name: costume.name,
        tone: 'costume' as const,
      })),
    });
  }
  return bands;
}

export function roundSummary(round: CastingRoundViewResponse): string {
  const parts = [
    `Round ${round.number}`,
    round.candidates.length < round.expectedCount
      ? `${round.candidates.length} of ${round.expectedCount} candidates`
      : countLabel(round.candidates.length, 'candidate'),
    round.routes.map((route) => `${route.model.name} × ${route.count}`).join(', '),
  ];
  if (round.estimatedCost) {
    parts.push(`estimated ${formatEstimatedCost(round.estimatedCost)}`);
  }
  return parts.join(' · ');
}

export function formatEstimatedCost(cost: CastingEstimatedCost): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency }).format(cost.amount);
}

export function lookDetails(
  look: CastCastingLookResponse,
  costumes: CastCastingResourceResponse['costumes']
): string[] {
  const lookCostumes = costumes.filter((costume) => costume.lookId === look.id);
  const pickedSheets = lookCostumes.filter((costume) => costume.characterSheetAssetFileId !== null).length;
  return [
    castingLine(look),
    lookCostumes.length === 0
      ? 'No costumes yet'
      : `${countLabel(lookCostumes.length, 'costume')} · ${countLabel(pickedSheets, 'sheet')} picked`,
  ];
}

function castingLine(look: CastCastingLookResponse): string {
  const castRound = look.rounds.find((round) =>
    round.candidates.some((candidate) => candidate.assetFileId === look.castCandidateAssetFileId)
  );
  const castCandidate = castRound?.candidates.find((candidate) => candidate.assetFileId === look.castCandidateAssetFileId);
  if (!castRound || !castCandidate) {
    return look.rounds.length === 0 ? 'Not cast yet' : `Not cast yet · ${countLabel(look.rounds.length, 'round')}`;
  }
  return `Cast from round ${castRound.number} of ${look.rounds.length} · ${castCandidate.model.name}`;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
