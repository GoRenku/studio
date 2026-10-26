import type { CastCastingResource, CastingRoundView } from '@gorenku/studio-core/client';
import type { CastingBoardRound } from './contracts.js';
import type { CastingBoardSessionRecord } from './session-state.js';

/** A round as the board shows it, with panel media URIs and the images still being generated. */
export function projectBoardRound(record: CastingBoardSessionRecord, round: CastingRoundView): CastingBoardRound {
  return {
    id: round.id,
    number: round.number,
    routes: round.routes,
    estimatedCost: round.estimatedCost,
    expectedCount: round.expectedCount,
    pending: pendingImages(round),
    candidates: round.candidates.map((candidate) => ({
      assetFileId: candidate.assetFileId,
      status: candidate.status,
      model: candidate.model,
      imageUri: record.media.uri(candidate.assetFile.projectRelativePath),
    })),
  };
}

/** Every round the board shows: the Look's casting rounds, or the rounds of the Look's costumes. */
export function boardRounds(record: CastingBoardSessionRecord, resource: CastCastingResource): CastingRoundView[] {
  const { subject } = record;
  if (subject.mode === 'candidates') {
    return resource.looks.find((look) => look.id === subject.lookId)?.rounds ?? [];
  }
  return resource.costumes.filter((costume) => costume.lookId === subject.lookId).flatMap((costume) => costume.rounds);
}

/** Kept images of some rounds; the round's choice (cast or picked) counts even when hidden. */
export function keptImageIds(rounds: CastingRoundView[], chosenAssetFileId: string | null): string[] {
  return rounds.flatMap((round) => round.candidates)
    .filter((candidate) => candidate.status !== 'hidden' || candidate.assetFileId === chosenAssetFileId)
    .map((candidate) => candidate.assetFileId);
}

/** Route counts per model key minus the images imported for that model. */
function pendingImages(round: CastingRoundView): CastingBoardRound['pending'] {
  const pending = new Map<string, { model: CastingBoardRound['pending'][number]['model']; count: number }>();
  for (const route of round.routes) {
    const entry = pending.get(route.model.key) ?? { model: route.model, count: 0 };
    entry.count += route.count;
    pending.set(route.model.key, entry);
  }
  for (const candidate of round.candidates) {
    const entry = pending.get(candidate.modelKey);
    if (entry) entry.count -= 1;
  }
  return [...pending.values()].filter((entry) => entry.count > 0);
}
