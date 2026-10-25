import { isStructuredError } from '@gorenku/studio-diagnostics';
import { generationRouteBilling, hostPlanUsageEstimate, type GenerationCostEstimate } from '@gorenku/studio-core/client';
import type { GenerationCostEstimator } from '@gorenku/studio-codex';
import { isEngineError, type CostEstimate, type MediaEngine, type ProviderContext } from '@gorenku/studio-engines';
import { createEngineContext } from './engine-context.js';
import { engineErrorSuggestion } from './engine-errors.js';
import { createRenkuMediaEngine } from './provider-registry.js';

/**
 * The one estimator every review, preview and picker uses. Host plan routes
 * get the plan usage envelope; every other route gets the Engines estimate
 * from saved prices. A failed estimate never blocks a review: it is reported
 * as a missing price.
 */
export function createGenerationCostEstimator(options: {
  mediaEngine?: MediaEngine;
  createProviderContext?: (input: { provider: string; homeDir?: string; signal: AbortSignal }) => Promise<ProviderContext>;
} = {}): GenerationCostEstimator {
  return {
    async estimate(input) {
      if (generationRouteBilling(input.provider) === 'hostPlanUsage') {
        return hostPlanUsageEstimate(input.requestSha256);
      }
      const controller = new AbortController();
      try {
        const context = await (options.createProviderContext ?? createEngineContext)({
          provider: input.provider,
          homeDir: input.homeDir,
          signal: controller.signal,
        });
        const engine = options.mediaEngine ?? createRenkuMediaEngine();
        const estimate = input.request === undefined
          ? await engine.estimateRouteDefaultsCost(input.provider, input.model, context, input.fields)
          : await engine.estimateCost(input.provider, { model: input.model, input: input.request }, context);
        return toGenerationCostEstimate(estimate, input.requestSha256);
      } catch (error) {
        if (!isEngineError(error) && !isStructuredError(error)) {
          throw error;
        }
        return {
          state: 'missingPrice',
          amountUsd: null,
          basis: 'The estimate is unavailable',
          observedAt: null,
          sourceUrl: null,
          notes: [error.message, ...(isEngineError(error) ? [engineErrorSuggestion(error)].filter((note): note is string => Boolean(note)) : [])],
          requestSha256: input.requestSha256,
        };
      }
    },
  };
}

function toGenerationCostEstimate(estimate: CostEstimate, requestSha256: string | null): GenerationCostEstimate {
  return {
    state: estimate.state,
    amountUsd: estimate.amountUsd ?? null,
    basis: estimate.basis,
    observedAt: estimate.observedAt ?? null,
    sourceUrl: estimate.sourceUrl ?? null,
    notes: estimate.notes,
    requestSha256,
  };
}
