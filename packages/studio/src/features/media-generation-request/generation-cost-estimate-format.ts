import type { GenerationCostEstimate } from '@gorenku/studio-core/client';

const STATE_LABELS: Record<GenerationCostEstimate['state'], string> = {
  computed: 'Estimated from the saved price',
  missingPrice: 'No price is known for this route',
  unpriced: 'This price cannot be estimated',
  hostPlanUsage: 'Plan usage',
};

/** Compact wording for menus and summaries. */
const SHORT_STATE_LABELS: Record<GenerationCostEstimate['state'], string> = {
  computed: 'Estimated',
  missingPrice: 'No price known',
  unpriced: 'Cannot estimate',
  hostPlanUsage: 'Plan usage',
};

/** The sentence describing an estimate state. */
export function estimateStateLabel(state: GenerationCostEstimate['state']): string {
  return STATE_LABELS[state];
}

/** The amount, or the estimate state in a few words, for a menu or summary line. */
export function shortEstimateLabel(estimate: GenerationCostEstimate): string {
  return estimate.amountUsd === null ? SHORT_STATE_LABELS[estimate.state] : formatUsd(estimate.amountUsd);
}

/** The one money format: cents, with up to four decimals below one dollar. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}
