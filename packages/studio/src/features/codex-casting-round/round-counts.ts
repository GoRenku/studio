import { estimateCastingRoundCost } from '@gorenku/studio-core/client';
import type { CastingRound, CastingRoundModelOption, CastingRoundProviderOption } from '@gorenku/studio-codex/casting-round';
import { formatUsd } from '@/features/media-generation-request/generation-cost-estimate-format';

/** Counts per ticked model, keyed by model key, in the panel's option order. */
export type RoundCounts = Record<string, number>;

/** The provider picked on each model's card, keyed by model key. */
export type RoundProviders = Record<string, string>;

/** The picked provider of a model, or the card's first provider. */
export function chosenProvider(option: CastingRoundModelOption, providers: RoundProviders): CastingRoundProviderOption {
  return option.providers.find((entry) => entry.provider === providers[option.model.key]) ?? option.providers[0]!;
}

/** Splits the total evenly across the ticked models; earlier models take the remainder. */
export function splitTotal(total: number, keys: string[]): RoundCounts {
  if (keys.length === 0) return {};
  const base = Math.floor(total / keys.length);
  const remainder = total % keys.length;
  return Object.fromEntries(keys.map((key, index) => [key, base + (index < remainder ? 1 : 0)]));
}

/** Keeps a total that gives every ticked model at least one candidate and no model more than its limit. */
export function clampTotal(total: number, tickedCount: number, maxCountPerModel: number): number {
  if (tickedCount === 0) return Math.max(1, total);
  return Math.min(Math.max(total, tickedCount), tickedCount * maxCountPerModel);
}

export function countsTotal(counts: RoundCounts): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

/** "10 candidates on 3 models, lowest detail, 4 at a time · estimated $0.67" from the recorded answer. */
export function answeredSummary(round: CastingRound): string {
  const answer = round.answer;
  if (answer?.kind !== 'generate') return '';
  const total = answer.routes.reduce((sum, route) => sum + route.count, 0);
  const models = `${answer.routes.length} ${answer.routes.length === 1 ? 'model' : 'models'}`;
  return `${total} ${total === 1 ? 'candidate' : 'candidates'} on ${models}, ${answer.detail} detail, ${answer.maxConcurrentGenerations} at a time · ${answeredCost(round.options, answer)}`;
}

function answeredCost(options: CastingRoundModelOption[], answer: Extract<CastingRound['answer'], { kind: 'generate' }>): string {
  if (answer.estimatedCost) return `estimated ${formatUsd(answer.estimatedCost.amount)}`;
  return estimateCastingRoundCost(options, answer.routes, answer.detail).hostPlanOnly ? 'ChatGPT plan usage' : 'estimate unavailable';
}
