import {
  lookupModel,
  type LoadedModelCatalog,
  type ModelPriceConfig,
} from '../model-catalog.js';
import {
  type GenerationEstimate,
  type GenerationPolicy,
  type GenerationRequest,
} from './contracts.js';
import { loadBundledGenerationCatalog } from './model-discovery.js';
import { hashGenerationRequest } from './request-hash.js';
import { validateGenerationProviderPayload } from './provider-payload-validation.js';
import {
  assignGenerationInputFilePayloadValue,
  createGenerationProviderPayloadBase,
} from './input-file-payload.js';

export async function estimateGeneration(input: {
  policy: GenerationPolicy;
  request: GenerationRequest;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationEstimate> {
  const catalog = input.catalog ?? (await loadBundledGenerationCatalog());
  const model = lookupModel(catalog, input.policy.provider, input.policy.model);
  if (!model) {
    throw new Error(
      `Unknown generation model: ${input.policy.provider}/${input.policy.model}.`
    );
  }
  const payload = buildLogicalProviderPayload(input.policy, input.request);
  await validateGenerationProviderPayload({
    catalog,
    provider: input.policy.provider,
    model: input.policy.model,
    payload,
  });
  const count =
    input.policy.outputCount ?? deriveGenerationOutputCount(payload);
  const pricing = model.price ?? null;
  const price =
    pricing === null
      ? null
      : typeof pricing === 'number'
        ? pricing * count
        : priceFromConfig(pricing, payload, count);

  const approvalToken = hashGenerationRequest({
    policy: input.policy,
    request: input.request,
  });

  return {
    provider: input.policy.provider,
    model: input.policy.model,
    mediaKind: input.policy.mediaKind,
    pricing,
    estimatedCostUsd: price,
    approvalToken,
    billableUnits: {
      outputCount: count,
      ...payload,
    },
    warnings:
      price === null ? ['No pricing is configured for this model.'] : [],
  };
}

export function buildLogicalProviderPayload(
  policy: GenerationPolicy,
  request: GenerationRequest
): Record<string, unknown> {
  const payload = createGenerationProviderPayloadBase(policy, request);
  for (const file of request.inputFiles ?? []) {
    if (file.required && !file.projectRelativePath) {
      throw new Error(
        `Missing required generation input file for ${file.field}.`
      );
    }
    const value = `renku-input://${encodeURI(file.projectRelativePath)}`;
    assignGenerationInputFilePayloadValue({ payload, file, value });
  }
  return payload;
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
    return (
      pricing.pricePerSecond * seconds(payload) * count +
      inputImageCost(pricing, payload, count)
    );
  }
  if (typeof pricing.pricePerMinute === 'number') {
    return pricing.pricePerMinute * Math.ceil(seconds(payload) / 60) * count;
  }
  if (typeof pricing.pricePerCharacter === 'number') {
    return pricing.pricePerCharacter * characters(payload) * count;
  }
  if (pricing.function === 'costByImageSizeAndQuality' && pricing.prices) {
    const row =
      pricing.prices.find((candidate) =>
        imageSizeAndQualityRowMatches(candidate, payload)
      ) ?? nearestCustomImageSizeRow(pricing.prices, payload);
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
  if (pricing.function === 'costByVideoDurationAndResolution' && pricing.prices) {
    const row = pricing.prices.find((candidate) =>
      Object.entries(candidate).every(([key, value]) => {
        if (key === 'pricePerSecond') {
          return true;
        }
        return payload[key] === value;
      })
    );
    const pricePerSecond = row?.pricePerSecond;
    return typeof pricePerSecond === 'number'
      ? pricePerSecond * seconds(payload) * count +
          inputImageCost(pricing, payload, count)
      : null;
  }
  if (pricing.function === 'costByVideoDurationAndWithAudio' && pricing.prices) {
    const row = pricing.prices.find((candidate) =>
      Object.entries(candidate).every(([key, value]) => {
        if (key === 'pricePerSecond') {
          return true;
        }
        return payload[key] === value;
      })
    );
    const pricePerSecond = row?.pricePerSecond;
    return typeof pricePerSecond === 'number'
      ? pricePerSecond * seconds(payload) * count +
          inputImageCost(pricing, payload, count)
      : null;
  }
  if (pricing.function === 'costByVideoPerMillionTokens') {
    return videoTokenPrice(pricing, payload, count);
  }
  return null;
}

function videoTokenPrice(
  pricing: ModelPriceConfig,
  payload: Record<string, unknown>,
  count: number
): number | null {
  const pricePerMillionTokens = videoTokenPricePerMillion(pricing, payload);
  if (typeof pricePerMillionTokens !== 'number') {
    return null;
  }
  const duration = seconds(payload);
  const { width, height } = videoDimensions(payload);
  const tokens = (width * height * duration * 30) / 1024;
  return (tokens / 1_000_000) * pricePerMillionTokens * count;
}

function videoTokenPricePerMillion(
  pricing: ModelPriceConfig,
  payload: Record<string, unknown>
): number | null {
  if (typeof pricing.pricePerMillionTokens === 'number') {
    return pricing.pricePerMillionTokens;
  }
  const rows = pricing.prices;
  if (!rows?.length) {
    return null;
  }
  const row =
    rows.find((candidate) =>
      Object.entries(candidate).every(([key, value]) => {
        if (key === 'pricePerMillionTokens') {
          return true;
        }
        return payload[key] === value;
      })
    ) ?? rows.find((candidate) => typeof candidate.pricePerMillionTokens === 'number');
  return typeof row?.pricePerMillionTokens === 'number'
    ? row.pricePerMillionTokens
    : null;
}

function videoDimensions(payload: Record<string, unknown>): PricingImageDimensions {
  const height = videoHeight(payload.resolution);
  return {
    width: videoWidthForAspectRatio(height, payload.aspect_ratio),
    height,
  };
}

function videoHeight(value: unknown): number {
  if (typeof value !== 'string') {
    return 1080;
  }
  const normalized = value.toLowerCase();
  if (normalized.includes('480')) {
    return 480;
  }
  if (normalized.includes('720')) {
    return 720;
  }
  if (normalized.includes('4k') || normalized.includes('2160')) {
    return 2160;
  }
  return 1080;
}

function videoWidthForAspectRatio(height: number, value: unknown): number {
  if (typeof value !== 'string') {
    return Math.round(height * (16 / 9));
  }
  const match = /^(\d+):(\d+)$/.exec(value);
  if (!match) {
    return Math.round(height * (16 / 9));
  }
  const widthRatio = Number(match[1]);
  const heightRatio = Number(match[2]);
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || heightRatio <= 0) {
    return Math.round(height * (16 / 9));
  }
  return Math.round(height * (widthRatio / heightRatio));
}

interface PricingImageDimensions {
  width: number;
  height: number;
}

const IMAGE_SIZE_PRICING_DIMENSIONS: Record<string, PricingImageDimensions> = {
  square: { width: 1024, height: 1024 },
  square_hd: { width: 1024, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  portrait_4_3: { width: 768, height: 1024 },
  landscape_16_9: { width: 1920, height: 1080 },
  portrait_16_9: { width: 1080, height: 1920 },
};

function imageSizeAndQualityRowMatches(
  row: Record<string, unknown>,
  payload: Record<string, unknown>
): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (key === 'pricePerImage') {
      return true;
    }
    if (key === 'image_size') {
      return imageSizesMatch(value, payload.image_size);
    }
    return Object.is(payload[key], value);
  });
}

function nearestCustomImageSizeRow(
  rows: Array<Record<string, unknown>>,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const payloadSize = readImageSizeDimensions(payload.image_size);
  if (!payloadSize || typeof payload.image_size !== 'object') {
    return null;
  }
  let best: { row: Record<string, unknown>; distance: number } | null = null;
  for (const row of rows) {
    if (!nonImageSizePriceFieldsMatch(row, payload)) {
      continue;
    }
    const rowSize = readImageSizeDimensions(row.image_size);
    if (!rowSize) {
      continue;
    }
    const distance = Math.abs(pixelArea(rowSize) - pixelArea(payloadSize));
    if (!best || distance < best.distance) {
      best = { row, distance };
    }
  }
  return best?.row ?? null;
}

function nonImageSizePriceFieldsMatch(
  row: Record<string, unknown>,
  payload: Record<string, unknown>
): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (key === 'pricePerImage' || key === 'image_size') {
      return true;
    }
    return Object.is(payload[key], value);
  });
}

function imageSizesMatch(expected: unknown, actual: unknown): boolean {
  if (Object.is(expected, actual)) {
    return true;
  }
  const expectedSize = readImageSizeDimensions(expected);
  const actualSize = readImageSizeDimensions(actual);
  return Boolean(
    expectedSize &&
      actualSize &&
      dimensionsMatch(expectedSize, actualSize)
  );
}

function readImageSizeDimensions(value: unknown): PricingImageDimensions | null {
  if (typeof value === 'string') {
    const preset = IMAGE_SIZE_PRICING_DIMENSIONS[value];
    if (preset) {
      return preset;
    }
    const match = /^(\d+)x(\d+)$/.exec(value);
    if (!match) {
      return null;
    }
    return {
      width: Number(match[1]!),
      height: Number(match[2]!),
    };
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const width = record.width;
  const height = record.height;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

function dimensionsMatch(
  expected: PricingImageDimensions,
  actual: PricingImageDimensions
): boolean {
  return (
    (expected.width === actual.width && expected.height === actual.height) ||
    (expected.width === actual.height && expected.height === actual.width)
  );
}

function pixelArea(dimensions: PricingImageDimensions): number {
  return dimensions.width * dimensions.height;
}

export function deriveGenerationOutputCount(
  payload: Record<string, unknown>
): number {
  const raw = payload.num_images ?? payload.numImages ?? payload.count;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function seconds(payload: Record<string, unknown>): number {
  const raw =
    payload.duration_seconds ?? payload.durationSeconds ?? payload.duration;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const secondsMatch = /^(\d+(?:\.\d+)?)s$/.exec(trimmed);
    const parsed = Number(secondsMatch?.[1] ?? trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function characters(payload: Record<string, unknown>): number {
  const raw = payload.text ?? payload.prompt ?? '';
  return typeof raw === 'string' ? raw.length : 0;
}

function inputImageCost(
  pricing: ModelPriceConfig,
  payload: Record<string, unknown>,
  outputCount: number
): number {
  if (typeof pricing.pricePerInputImage !== 'number') {
    return 0;
  }
  return pricing.pricePerInputImage * inputImageCount(payload) * outputCount;
}

function inputImageCount(payload: Record<string, unknown>): number {
  let count = 0;
  if (typeof payload.image_url === 'string' && payload.image_url.length > 0) {
    count += 1;
  }
  if (Array.isArray(payload.image_urls)) {
    count += payload.image_urls.filter(
      (value) => typeof value === 'string' && value.length > 0
    ).length;
  }
  return count;
}
