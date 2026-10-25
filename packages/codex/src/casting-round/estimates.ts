import { IMAGE_DETAIL_LEVELS, type GenerationCostEstimate, type ImageDetailLevel } from '@gorenku/studio-core/client';
import type { GenerationCostEstimator } from '../generation-review-estimate.js';
import type { CastingRoundModelOption } from './contracts.js';
import type { CastingRoundOptionRecord, CastingRoundProviderRecord } from './options.js';

/**
 * Prices one candidate per offered model and provider at every detail level,
 * by estimating one output of the provider's route with that level's native
 * fields from the Default Model List. References and other settings of the
 * eventual request are accepted estimate error; host plan routes come back as
 * plan usage from the estimator.
 */
export async function estimateCastingRoundOptions(
  options: CastingRoundOptionRecord[],
  estimator: GenerationCostEstimator,
  homeDir?: string,
): Promise<CastingRoundModelOption[]> {
  return Promise.all(options.map(async (option) => ({
    model: option.model,
    note: option.note,
    providers: await Promise.all(option.providers.map(async (provider) => ({
      provider: provider.provider,
      providerLabel: provider.providerLabel,
      estimates: await estimateLevels(provider, estimator, homeDir),
    }))),
  })));
}

/** Levels with the same native fields share one estimate. */
async function estimateLevels(
  provider: CastingRoundProviderRecord,
  estimator: GenerationCostEstimator,
  homeDir?: string,
): Promise<Record<ImageDetailLevel, GenerationCostEstimate>> {
  const byFields = new Map<string, Promise<GenerationCostEstimate>>();
  const estimate = (level: ImageDetailLevel) => {
    const fields = provider.detail[level];
    const key = JSON.stringify(fields);
    if (!byFields.has(key)) {
      byFields.set(key, estimator.estimate({ homeDir, provider: provider.provider, model: provider.route, fields, requestSha256: null }));
    }
    return byFields.get(key)!;
  };
  const estimates = await Promise.all(IMAGE_DETAIL_LEVELS.map(estimate));
  return Object.fromEntries(IMAGE_DETAIL_LEVELS.map((level, index) => [level, estimates[index]!])) as Record<ImageDetailLevel, GenerationCostEstimate>;
}
