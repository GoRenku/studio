import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate, GenerationRouteBilling } from '../generation-cost-estimate.js';
import type { GenerationLaneModel } from '../project-settings.js';
import type { CastingRoute } from './model.js';

/** One provider's existing Engines estimate for one casting candidate. */
export interface CastingProviderEstimate {
  provider: string;
  billing: GenerationRouteBilling;
  /** Host plan usage needs no provider estimate. */
  estimate: GenerationCostEstimate | null;
}

export interface CastingModelEstimate {
  model: GenerationLaneModel;
  providers: CastingProviderEstimate[];
}

export interface CastingRoundCostEstimate {
  /** Null when any charged route has no estimate or no route is charged. */
  amountUsd: number | null;
  breakdown: Array<{ name: string; amountUsd: number }>;
  unpriced: string[];
  hostPlanOnly: boolean;
}

/** Aggregates Engines estimates by candidate count; provider pricing stays in Engines. */
export function estimateCastingRoundCost(options: CastingModelEstimate[], routes: CastingRoute[]): CastingRoundCostEstimate {
  const breakdown: CastingRoundCostEstimate['breakdown'] = [];
  const unpriced: string[] = [];
  let hostCount = 0;
  for (const route of routes) {
    const option = options.find((candidate) => candidate.model.key === route.model.key);
    const provider = option?.providers.find((candidate) => candidate.provider === route.provider);
    if (!option || !provider) {
      throw new StructuredError({ code: 'CASTING_ROUND_ESTIMATE_ROUTE_INVALID', message: 'Estimate a model and provider offered for this Casting Round.' });
    }
    if (provider.billing === 'hostPlanUsage') {
      hostCount += 1;
    } else if (provider.estimate === null || provider.estimate.amountUsd === null) {
      unpriced.push(option.model.name);
    } else {
      breakdown.push({ name: option.model.name, amountUsd: roundUsd(provider.estimate.amountUsd * route.count) });
    }
  }
  return {
    amountUsd: unpriced.length > 0 || breakdown.length === 0 ? null : roundUsd(breakdown.reduce((total, entry) => total + entry.amountUsd, 0)),
    breakdown,
    unpriced,
    hostPlanOnly: routes.length > 0 && hostCount === routes.length,
  };
}

function roundUsd(amount: number): number {
  return Math.round(amount * 1e6) / 1e6;
}
