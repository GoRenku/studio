/**
 * The display envelope of a generation cost estimate. Engines computes every
 * request amount; Core aggregates casting candidate counts and Studio shows it.
 * `hostPlanUsage` marks routes that run on the agent host's plan instead of a
 * provider charge.
 */
export type GenerationCostEstimateState =
  | 'quoted'
  | 'computed'
  | 'missingPrice'
  | 'expired'
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
  /** The SHA-256 of the request bytes; null for a model-level price comparison. */
  requestSha256: string | null;
}

/** How a route is paid for, from the Skill's Route Description. */
export type GenerationRouteBilling = 'providerCharge' | 'hostPlanUsage';
