import type { CostEstimate } from '../pricing/contracts.js';

/**
 * Local reference prices for quick image-model comparisons, checked 2026-10-24.
 * Typical settings, rounded estimates, shared across providers. Update with
 * the model catalog; opening a picker must never fetch prices or schemas.
 */
const IMAGE_PRICES: Readonly<Record<string, { amountUsd: number; sourceUrl: string }>> = {
  'gpt-image-2': { amountUsd: 0.15, sourceUrl: 'https://fal.ai/models/openai/gpt-image-2' },
  'nano-banana': { amountUsd: 0.08, sourceUrl: 'https://fal.ai/models/fal-ai/nano-banana-2' },
  'flux-3-image': { amountUsd: 0.05, sourceUrl: 'https://fal.ai/models/blackforestlabs/flux-3/text-to-image' },
  'seedream-5.0-pro': { amountUsd: 0.07, sourceUrl: 'https://fal.ai/models/bytedance/seedream/v5/pro/text-to-image' },
  'grok-imagine-image': { amountUsd: 0.02, sourceUrl: 'https://fal.ai/models/xai/grok-imagine-image' },
  'flux-kontext-pro': { amountUsd: 0.04, sourceUrl: 'https://fal.ai/models/fal-ai/flux-pro/kontext/text-to-image' },
  'z-image-turbo': { amountUsd: 0.005, sourceUrl: 'https://fal.ai/models/fal-ai/z-image/turbo' },
};

/** A model-level estimate, independent of the eventual native generation request. */
export function estimateImageCost(modelKey: string): CostEstimate {
  const price = Object.hasOwn(IMAGE_PRICES, modelKey) ? IMAGE_PRICES[modelKey] : undefined;
  if (!price) return { state: 'missingPrice', basis: 'No reference image price is listed for this model', notes: [] };
  return {
    state: 'computed',
    amountUsd: price.amountUsd,
    basis: 'Approximate per image at typical settings; provider, size and quality can change the charge',
    observedAt: '2026-10-24T00:00:00.000Z',
    sourceUrl: price.sourceUrl,
    notes: [],
  };
}
