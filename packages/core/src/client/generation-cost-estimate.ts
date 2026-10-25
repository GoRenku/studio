import { HOST_GENERATION_PROVIDER } from './generation-lanes.js';

/**
 * The display envelope of a generation cost estimate. Engines computes every
 * request amount; Core aggregates casting candidate counts and Studio shows it.
 * `hostPlanUsage` marks routes that run on the agent host's plan instead of a
 * provider charge.
 */
export type GenerationCostEstimateState =
  | 'computed'
  | 'missingPrice'
  | 'unpriced'
  | 'hostPlanUsage';

export interface GenerationCostEstimate {
  state: GenerationCostEstimateState;
  /** Never 0 for an unknown price; null whenever no amount is known. */
  amountUsd: number | null;
  basis: string;
  observedAt: string | null;
  sourceUrl: string | null;
  notes: string[];
  /** The SHA-256 of the request bytes; null for a route estimate at its defaults. */
  requestSha256: string | null;
}

/** How a route is paid for. */
export type GenerationRouteBilling = 'providerCharge' | 'hostPlanUsage';

/** The agent host's built-in provider runs on the host's plan; every other provider charges. */
export function generationRouteBilling(provider: string): GenerationRouteBilling {
  return provider === HOST_GENERATION_PROVIDER.provider ? 'hostPlanUsage' : 'providerCharge';
}

/** The estimate of a host plan route, which no provider prices. */
export function hostPlanUsageEstimate(requestSha256: string | null): GenerationCostEstimate {
  return {
    state: 'hostPlanUsage',
    amountUsd: null,
    basis: 'Uses your ChatGPT plan\'s Codex usage',
    observedAt: null,
    sourceUrl: null,
    notes: [],
    requestSha256,
  };
}
