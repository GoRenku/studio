import { lookupModel, type LoadedModelCatalog, type ModelPriceConfig } from '../model-catalog.js';
import {
  type GenerationEstimate,
  type GenerationPolicy,
  type GenerationRequest,
} from './contracts.js';
import { loadBundledGenerationCatalog } from './model-discovery.js';
import { hashGenerationRequest } from './request-hash.js';
import { validateGenerationProviderPayload } from './provider-payload-validation.js';

export async function estimateGeneration(input: {
  policy: GenerationPolicy;
  request: GenerationRequest;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationEstimate> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const model = lookupModel(catalog, input.policy.provider, input.policy.model);
  if (!model) {
    throw new Error(
      `Unknown generation model: ${input.policy.provider}/${input.policy.model}.`
    );
  }
  const payload: Record<string, unknown> = {
    ...(input.request.parameters ?? {}),
    ...(input.policy.parameters ?? {}),
  };
  if (input.request.prompt) {
    payload.prompt = input.request.prompt;
  }
  await validateGenerationProviderPayload({
    catalog,
    provider: input.policy.provider,
    model: input.policy.model,
    payload,
  });
  const count = input.policy.outputCount ?? outputCount(payload);
  const pricing = model.price ?? null;
  const price = pricing === null
    ? null
    : typeof pricing === 'number'
      ? pricing * count
      : priceFromConfig(pricing, payload, count);

  return {
    provider: input.policy.provider,
    model: input.policy.model,
    mediaKind: input.policy.mediaKind,
    pricing,
    estimatedCostUsd: price,
    approvalToken: hashGenerationRequest(input),
    billableUnits: {
      outputCount: count,
      ...payload,
    },
    warnings: price === null ? ['No pricing is configured for this model.'] : [],
  };
}

function priceFromConfig(
  pricing: ModelPriceConfig,
  payload: Record<string, unknown>,
  count: number
): number | null {
  if (typeof pricing.price === 'number') {
    return pricing.price * count;
  }
  if (typeof pricing.pricePerImage === 'number') {
    return pricing.pricePerImage * count;
  }
  if (typeof pricing.pricePerSecond === 'number') {
    return pricing.pricePerSecond * seconds(payload) * count;
  }
  if (typeof pricing.pricePerMinute === 'number') {
    return pricing.pricePerMinute * Math.ceil(seconds(payload) / 60) * count;
  }
  if (typeof pricing.pricePerCharacter === 'number') {
    return pricing.pricePerCharacter * characters(payload) * count;
  }
  if (pricing.function === 'costByImageSizeAndQuality' && pricing.prices) {
    const row = pricing.prices.find((candidate) =>
      Object.entries(candidate).every(([key, value]) => {
        if (key === 'pricePerImage') {
          return true;
        }
        return payload[key] === value;
      })
    );
    const pricePerImage = row?.pricePerImage;
    return typeof pricePerImage === 'number' ? pricePerImage * count : null;
  }
  if (pricing.function === 'costByImageAndResolution' && pricing.prices) {
    const row = pricing.prices.find((candidate) =>
      Object.entries(candidate).every(([key, value]) => {
        if (key === 'pricePerImage') {
          return true;
        }
        return payload[key] === value;
      })
    );
    const pricePerImage = row?.pricePerImage;
    return typeof pricePerImage === 'number' ? pricePerImage * count : null;
  }
  return null;
}

function outputCount(payload: Record<string, unknown>): number {
  const raw = payload.num_images ?? payload.numImages ?? payload.count;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function seconds(payload: Record<string, unknown>): number {
  const raw = payload.duration_seconds ?? payload.durationSeconds ?? payload.duration;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function characters(payload: Record<string, unknown>): number {
  const raw = payload.text ?? payload.prompt ?? '';
  return typeof raw === 'string' ? raw.length : 0;
}
