import { isStructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import type { GenerationCostEstimator } from '@gorenku/studio-codex';
import { estimateImageCost, isEngineError, type CostEstimate, type MediaEngine, type ProviderContext } from '@gorenku/studio-engines';
import { createEngineContext } from './engine-context.js';
import { createRenkuMediaEngine } from './provider-registry.js';

/**
 * Composes the Engines estimate into Core's display envelope. A failed
 * estimate never blocks a review: it is reported as a missing price.
 */
export function createGenerationCostEstimator(options: {
  mediaEngine?: MediaEngine;
  createProviderContext?: (input: { provider: string; homeDir?: string; signal: AbortSignal }) => Promise<ProviderContext>;
} = {}): GenerationCostEstimator {
  return {
    async estimateImage(modelKey) {
      return toGenerationCostEstimate(estimateImageCost(modelKey), null);
    },
    async estimate(input) {
      const controller = new AbortController();
      try {
        const context = await (options.createProviderContext ?? createEngineContext)({
          provider: input.provider,
          homeDir: input.homeDir,
          signal: controller.signal,
        });
        const estimate = await (options.mediaEngine ?? createRenkuMediaEngine())
          .estimateCost(input.provider, { model: input.model, input: input.request }, context);
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
          notes: [error.message],
          requestSha256: input.requestSha256,
        };
      }
    },
  };
}

export function toGenerationCostEstimate(estimate: CostEstimate, requestSha256: string | null): GenerationCostEstimate {
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
