import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import type { GenerationCostEstimator } from '../generation-review-estimate.js';

/** A fixed computed estimate that records each request it was asked to price. */
export function createFakeCostEstimator(amountUsd = 0.42): GenerationCostEstimator & { calls: Array<Parameters<GenerationCostEstimator['estimate']>[0]> } {
  const calls: Array<Parameters<GenerationCostEstimator['estimate']>[0]> = [];
  return {
    calls,
    async estimate(input): Promise<GenerationCostEstimate> {
      calls.push(structuredClone(input));
      return { state: 'computed', amountUsd, basis: 'Fixture price', observedAt: '2026-10-12T00:00:00.000Z', sourceUrl: null, notes: [], requestSha256: input.requestSha256 };
    },
  };
}
