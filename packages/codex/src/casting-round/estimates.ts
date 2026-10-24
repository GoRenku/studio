import type { GenerationCostEstimator } from '../generation-review-estimate.js';
import type { CastingRoundModelOption } from './contracts.js';
import type { CastingRoundOptionRecord } from './options.js';

/**
 * Looks up one local approximate price per paid model. Provider differences
 * are accepted estimate error; host plan usage needs no price lookup.
 */
export async function estimateCastingRoundOptions(
  options: CastingRoundOptionRecord[],
  estimator: GenerationCostEstimator,
): Promise<CastingRoundModelOption[]> {
  return Promise.all(options.map(async (option) => {
    const estimate = option.providers.some((provider) => provider.billing === 'providerCharge')
      ? await estimator.estimateImage(option.model.key)
      : null;
    return {
      model: option.model,
      note: option.note,
      providers: option.providers.map((provider) => ({
        provider: provider.provider,
        providerLabel: provider.providerLabel,
        billing: provider.billing,
        estimate: provider.billing === 'hostPlanUsage' ? null : estimate,
      })),
    };
  }));
}
