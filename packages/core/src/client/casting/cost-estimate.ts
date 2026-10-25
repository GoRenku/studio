import { StructuredError } from '@gorenku/studio-diagnostics';
import type { ImageDetailLevel } from '../default-models.js';
import type { GenerationCostEstimate } from '../generation-cost-estimate.js';
import type { GenerationLaneModel } from '../project-settings.js';
import type { CastingRoute } from './model.js';

/** One provider's estimate for one casting candidate at each detail level; host plan routes carry plan usage. */
export interface CastingProviderEstimate {
  provider: string;
  estimates: Record<ImageDetailLevel, GenerationCostEstimate>;
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

/** Aggregates the estimates of one detail level by candidate count; provider pricing stays in Engines. */
export function estimateCastingRoundCost(options: CastingModelEstimate[], routes: CastingRoute[], detail: ImageDetailLevel): CastingRoundCostEstimate {
  const breakdown: CastingRoundCostEstimate['breakdown'] = [];
  const unpriced: string[] = [];
  let hostCount = 0;
  for (const route of routes) {
    const option = options.find((candidate) => candidate.model.key === route.model.key);
    const provider = option?.providers.find((candidate) => candidate.provider === route.provider);
    if (!option || !provider) {
      throw new StructuredError({ code: 'CASTING_ROUND_ESTIMATE_ROUTE_INVALID', message: 'Estimate a model and provider offered for this Casting Round.' });
    }
    const estimate = provider.estimates[detail];
    if (estimate.state === 'hostPlanUsage') {
      hostCount += 1;
    } else if (estimate.amountUsd === null) {
      unpriced.push(option.model.name);
    } else {
      breakdown.push({ name: option.model.name, amountUsd: roundUsd(estimate.amountUsd * route.count) });
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
