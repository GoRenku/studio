import crypto from 'node:crypto';
import {
  lookupModel,
  type LoadedModelCatalog,
  type ModelPriceConfig,
} from '../model-catalog.js';
import {
  type GenerationCostEstimate,
  type GenerationPriceKey,
  type GenerationPricingInputs,
} from './contracts.js';
import { loadBundledGenerationCatalog } from './model-discovery.js';

export async function estimateGenerationCost(input: {
  priceKey: GenerationPriceKey;
  pricingInputs: GenerationPricingInputs;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationCostEstimate> {
  const catalog = input.catalog ?? (await loadBundledGenerationCatalog());
  const model = lookupModel(
    catalog,
    input.priceKey.provider,
    input.priceKey.model
  );
  const billableUnits = billableUnitsFromPricingInputs(input.pricingInputs);
  if (!model) {
    return unpricedEstimate({
      priceKey: input.priceKey,
      pricing: null,
      billableUnits,
      reason: `No model catalog entry exists for ${input.priceKey.provider}/${input.priceKey.model}.`,
      tokenBasis: null,
    });
  }

  const pricing = model.price ?? null;
  if (pricing === null) {
    return unpricedEstimate({
      priceKey: input.priceKey,
      pricing,
      billableUnits,
      reason: 'No pricing is configured for this provider model.',
      tokenBasis: null,
    });
  }

  const missingInputs = missingPricingInputs(pricing, input.pricingInputs);
  if (missingInputs.length > 0) {
    return {
      state: 'missing-pricing-input',
      provider: input.priceKey.provider,
      model: input.priceKey.model,
      mediaKind: input.priceKey.mediaKind,
      pricing,
      estimatedCostUsd: null,
      missingInputs,
      costApprovalToken: null,
      billableUnits,
      warnings: [
        `Missing pricing input${missingInputs.length === 1 ? '' : 's'}: ${missingInputs.join(', ')}.`,
      ],
    };
  }

  const outputCount = normalizedOutputCount(input.pricingInputs.outputCount);
  const price =
    typeof pricing === 'number'
      ? pricing * outputCount
      : priceFromConfig(pricing, input.pricingInputs, outputCount);

  if (price === null) {
    return unpricedEstimate({
      priceKey: input.priceKey,
      pricing,
      billableUnits,
      reason: 'No matching pricing row is configured for the requested pricing inputs.',
      tokenBasis: {
        priceKey: input.priceKey,
        pricingInputs: normalizedPricingInputs(input.pricingInputs),
        pricing,
        state: 'unpriced',
      },
    });
  }

  return {
    state: 'priced',
    provider: input.priceKey.provider,
    model: input.priceKey.model,
    mediaKind: input.priceKey.mediaKind,
    pricing,
    estimatedCostUsd: price,
    costApprovalToken: hashGenerationCostApproval({
      priceKey: input.priceKey,
      pricingInputs: normalizedPricingInputs(input.pricingInputs),
      pricing,
      state: 'priced',
      estimatedCostUsd: price,
    }),
    billableUnits,
    warnings: [],
  };
}

export function hashGenerationCostApproval(input: unknown): string {
  return `sha256:${crypto
    .createHash('sha256')
    .update(stableStringify(input))
    .digest('hex')}`;
}

function unpricedEstimate(input: {
  priceKey: GenerationPriceKey;
  pricing: ModelPriceConfig | number | null;
  billableUnits: Record<string, unknown>;
  reason: string;
  tokenBasis: unknown;
}): Extract<GenerationCostEstimate, { state: 'unpriced' }> {
  return {
    state: 'unpriced',
    provider: input.priceKey.provider,
    model: input.priceKey.model,
    mediaKind: input.priceKey.mediaKind,
    pricing: input.pricing,
    estimatedCostUsd: null,
    reason: input.reason,
    costApprovalToken: input.tokenBasis
      ? hashGenerationCostApproval(input.tokenBasis)
      : null,
    billableUnits: input.billableUnits,
    warnings: [input.reason],
  };
}

function priceFromConfig(
  pricing: ModelPriceConfig,
  inputs: GenerationPricingInputs,
  outputCount: number
): number | null {
  if (typeof pricing.price === 'number') {
    return pricing.price * outputCount;
  }
  if (typeof pricing.pricePerImage === 'number') {
    return pricing.pricePerImage * outputCount;
  }
  if (typeof pricing.pricePerSecond === 'number') {
    return (
      pricing.pricePerSecond * seconds(inputs.durationSeconds) * outputCount +
      inputImageCost(pricing, inputs, outputCount)
    );
  }
  if (typeof pricing.pricePerMinute === 'number') {
    return (
      pricing.pricePerMinute *
      Math.ceil(seconds(inputs.durationSeconds) / 60) *
      outputCount
    );
  }
  if (typeof pricing.pricePerCharacter === 'number') {
    return pricing.pricePerCharacter * characterCount(inputs) * outputCount;
  }
  if (typeof pricing.pricePerMegapixel === 'number') {
    return megapixelPrice(pricing, inputs, outputCount);
  }
  if (pricing.function === 'costByImageSizeAndQuality' && pricing.prices) {
    const row =
      pricing.prices.find((candidate) =>
        imageSizeAndQualityRowMatches(candidate, inputs)
      ) ?? nearestCustomImageSizeRow(pricing.prices, inputs);
    const pricePerImage = row?.pricePerImage;
    return typeof pricePerImage === 'number'
      ? pricePerImage * outputCount
      : null;
  }
  if (pricing.function === 'costByImageAndResolution' && pricing.prices) {
    const row = pricing.prices.find((candidate) =>
      rowMatches(candidate, {
        resolution: inputs.resolution,
      })
    );
    const pricePerImage = row?.pricePerImage;
    return typeof pricePerImage === 'number'
      ? pricePerImage * outputCount
      : null;
  }
  if (
    (pricing.function === 'costByVideoDurationAndResolution' ||
      pricing.function === 'costByVideoDurationAndWithAudio' ||
      pricing.function === 'costByVideoDurationAndAudioVoiceControl' ||
      pricing.function === 'costByVideoDurationModeAndAudio' ||
      pricing.function === 'costByVideoDurationAndMode') &&
    pricing.prices
  ) {
    if (
      pricing.function === 'costByVideoDurationAndAudioVoiceControl' &&
      inputs.usesVoiceControl === true &&
      inputs.generateAudio === false
    ) {
      return null;
    }
    const row = pricing.prices.find((candidate) =>
      rowMatches(candidate, {
        resolution: inputs.resolution,
        generate_audio: inputs.generateAudio,
        uses_voice_control: inputs.usesVoiceControl,
        mode: inputs.mode,
      })
    );
    const pricePerSecond = row?.pricePerSecond;
    return typeof pricePerSecond === 'number'
      ? pricePerSecond * seconds(inputs.durationSeconds) * outputCount +
          inputImageCost(pricing, inputs, outputCount)
      : null;
  }
  if (pricing.function === 'costByVideoPerMillionTokens') {
    return videoTokenPrice(pricing, inputs, outputCount);
  }
  return null;
}

function missingPricingInputs(
  pricing: ModelPriceConfig | number,
  inputs: GenerationPricingInputs
): string[] {
  if (typeof pricing === 'number') {
    return [];
  }
  const required = new Set(pricing.inputs ?? inferredPricingInputs(pricing));
  const missing = [...required]
    .map((inputName) => missingPricingInput(inputName, inputs))
    .filter((inputName): inputName is string => Boolean(inputName));
  return [...new Set(missing)];
}

function inferredPricingInputs(pricing: ModelPriceConfig): string[] {
  if (
    typeof pricing.price === 'number' ||
    typeof pricing.pricePerImage === 'number'
  ) {
    return [];
  }
  if (typeof pricing.pricePerSecond === 'number') {
    return ['duration'];
  }
  if (typeof pricing.pricePerMinute === 'number') {
    return ['duration'];
  }
  if (typeof pricing.pricePerCharacter === 'number') {
    return ['text'];
  }
  return [];
}

function missingPricingInput(
  inputName: string,
  inputs: GenerationPricingInputs
): string | null {
  if (inputName === 'num_images' || inputName === 'count') {
    return hasPositiveNumber(inputs.outputCount) ? null : 'outputCount';
  }
  if (inputName === 'image_size') {
    return inputs.imageSize === undefined ? 'imageSize' : null;
  }
  if (inputName === 'video_size') {
    return inputs.videoSize === undefined ? 'videoSize' : null;
  }
  if (inputName === 'quality') {
    return inputs.quality === undefined ? 'quality' : null;
  }
  if (inputName === 'resolution') {
    return inputs.resolution === undefined ? 'resolution' : null;
  }
  if (inputName === 'duration' || inputName === 'duration_seconds') {
    return readPositiveSeconds(inputs.durationSeconds) === null
      ? 'durationSeconds'
      : null;
  }
  if (inputName === 'text') {
    return typeof inputs.characterCount === 'number' &&
      Number.isFinite(inputs.characterCount) &&
      inputs.characterCount >= 0
      ? null
      : 'characterCount';
  }
  if (inputName === 'aspect_ratio') {
    return inputs.aspectRatio === undefined ? 'aspectRatio' : null;
  }
  if (inputName === 'generate_audio') {
    return typeof inputs.generateAudio === 'boolean'
      ? null
      : 'generateAudio';
  }
  if (inputName === 'uses_voice_control') {
    return inputs.usesVoiceControl === undefined ||
      typeof inputs.usesVoiceControl === 'boolean'
      ? null
      : 'usesVoiceControl';
  }
  if (inputName === 'image_url' || inputName === 'image_urls') {
    return typeof inputs.inputImageCount === 'number' &&
      Number.isFinite(inputs.inputImageCount) &&
      inputs.inputImageCount >= 0
      ? null
      : 'inputImageCount';
  }
  if (inputName === 'audio_url' || inputName === 'audio_urls') {
    return typeof inputs.inputAudioCount === 'number' &&
      Number.isFinite(inputs.inputAudioCount) &&
      inputs.inputAudioCount >= 0
      ? null
      : 'inputAudioCount';
  }
  if (inputName === 'video_url' || inputName === 'video_urls') {
    return typeof inputs.inputVideoCount === 'number' &&
      Number.isFinite(inputs.inputVideoCount) &&
      inputs.inputVideoCount >= 0
      ? null
      : 'inputVideoCount';
  }
  if (inputName === 'num_frames') {
    return hasPositiveNumber(inputs.numFrames) ? null : 'numFrames';
  }
  if (inputName === 'mode') {
    return inputs.mode === undefined ? 'mode' : null;
  }
  if (inputName === 'music_length_ms') {
    return hasPositiveNumber(inputs.musicLengthMs) ? null : 'musicLengthMs';
  }
  return null;
}

function billableUnitsFromPricingInputs(
  inputs: GenerationPricingInputs
): Record<string, unknown> {
  const units: Record<string, unknown> = {};
  const normalized = normalizedPricingInputs(inputs);
  if (normalized.outputCount !== undefined) {
    units.outputCount = normalized.outputCount;
  }
  if (normalized.inputImageCount !== undefined) {
    units.inputImageCount = normalized.inputImageCount;
  }
  if (normalized.inputAudioCount !== undefined) {
    units.inputAudioCount = normalized.inputAudioCount;
  }
  if (normalized.inputVideoCount !== undefined) {
    units.inputVideoCount = normalized.inputVideoCount;
  }
  if (normalized.durationSeconds !== undefined) {
    units.duration = normalized.durationSeconds;
  }
  if (normalized.characterCount !== undefined) {
    units.characterCount = normalized.characterCount;
  }
  if (normalized.imageSize !== undefined) {
    units.image_size = normalized.imageSize;
  }
  if (normalized.videoSize !== undefined) {
    units.video_size = normalized.videoSize;
  }
  if (normalized.resolution !== undefined) {
    units.resolution = normalized.resolution;
  }
  if (normalized.aspectRatio !== undefined) {
    units.aspect_ratio = normalized.aspectRatio;
  }
  if (normalized.quality !== undefined) {
    units.quality = normalized.quality;
  }
  if (normalized.generateAudio !== undefined) {
    units.generate_audio = normalized.generateAudio;
  }
  if (normalized.usesVoiceControl !== undefined) {
    units.uses_voice_control = normalized.usesVoiceControl;
  }
  if (normalized.numFrames !== undefined) {
    units.num_frames = normalized.numFrames;
  }
  if (normalized.mode !== undefined) {
    units.mode = normalized.mode;
  }
  if (normalized.musicLengthMs !== undefined) {
    units.music_length_ms = normalized.musicLengthMs;
  }
  return units;
}

function normalizedPricingInputs(
  inputs: GenerationPricingInputs
): GenerationPricingInputs {
  return {
    ...(inputs.outputCount !== undefined
      ? { outputCount: normalizedOutputCount(inputs.outputCount) }
      : {}),
    ...(inputs.inputImageCount !== undefined
      ? { inputImageCount: normalizedNonNegativeCount(inputs.inputImageCount) }
      : {}),
    ...(inputs.inputAudioCount !== undefined
      ? { inputAudioCount: normalizedNonNegativeCount(inputs.inputAudioCount) }
      : {}),
    ...(inputs.inputVideoCount !== undefined
      ? { inputVideoCount: normalizedNonNegativeCount(inputs.inputVideoCount) }
      : {}),
    ...(inputs.durationSeconds !== undefined
      ? { durationSeconds: inputs.durationSeconds }
      : {}),
    ...(inputs.characterCount !== undefined
      ? { characterCount: normalizedNonNegativeCount(inputs.characterCount) }
      : {}),
    ...(inputs.imageSize !== undefined ? { imageSize: inputs.imageSize } : {}),
    ...(inputs.resolution !== undefined ? { resolution: inputs.resolution } : {}),
    ...(inputs.aspectRatio !== undefined
      ? { aspectRatio: inputs.aspectRatio }
      : {}),
    ...(inputs.quality !== undefined ? { quality: inputs.quality } : {}),
    ...(inputs.generateAudio !== undefined
      ? { generateAudio: inputs.generateAudio }
      : {}),
    ...(inputs.usesVoiceControl !== undefined
      ? { usesVoiceControl: inputs.usesVoiceControl }
      : {}),
    ...(inputs.numFrames !== undefined
      ? { numFrames: normalizedNonNegativeCount(inputs.numFrames) }
      : {}),
    ...(inputs.videoSize !== undefined ? { videoSize: inputs.videoSize } : {}),
    ...(inputs.mode !== undefined ? { mode: inputs.mode } : {}),
    ...(inputs.musicLengthMs !== undefined
      ? { musicLengthMs: normalizedNonNegativeCount(inputs.musicLengthMs) }
      : {}),
  };
}

function videoTokenPrice(
  pricing: ModelPriceConfig,
  inputs: GenerationPricingInputs,
  outputCount: number
): number | null {
  const pricePerMillionTokens = videoTokenPricePerMillion(pricing, inputs);
  if (typeof pricePerMillionTokens !== 'number') {
    return null;
  }
  const duration = seconds(inputs.durationSeconds);
  const { width, height } = videoDimensions(inputs);
  const tokenFramesPerSecond = pricing.tokenFramesPerSecond ?? 30;
  const tokens = (width * height * duration * tokenFramesPerSecond) / 1024;
  return (tokens / 1_000_000) * pricePerMillionTokens * outputCount;
}

function videoTokenPricePerMillion(
  pricing: ModelPriceConfig,
  inputs: GenerationPricingInputs
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
      rowMatches(candidate, {
        resolution: inputs.resolution,
        aspect_ratio: inputs.aspectRatio,
        generate_audio: inputs.generateAudio,
      })
    ) ??
    rows.find(
      (candidate) => typeof candidate.pricePerMillionTokens === 'number'
    );
  return typeof row?.pricePerMillionTokens === 'number'
    ? row.pricePerMillionTokens
    : null;
}

function megapixelPrice(
  pricing: ModelPriceConfig,
  inputs: GenerationPricingInputs,
  outputCount: number
): number | null {
  if (typeof pricing.pricePerMegapixel !== 'number') {
    return null;
  }
  const dimensions =
    readImageSizeDimensions(inputs.imageSize) ??
    readImageSizeDimensions(inputs.videoSize);
  if (!dimensions) {
    return null;
  }
  const frames = normalizedOutputCount(inputs.numFrames ?? 1);
  const megapixels = (dimensions.width * dimensions.height * frames) / 1_000_000;
  return pricing.pricePerMegapixel * megapixels * outputCount;
}

function videoDimensions(inputs: GenerationPricingInputs): PricingImageDimensions {
  const explicit = readImageSizeDimensions(inputs.videoSize);
  if (explicit) {
    return explicit;
  }
  const height = videoHeight(inputs.resolution);
  return {
    width: videoWidthForAspectRatio(height, inputs.aspectRatio),
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
  if (normalized.includes('1440')) {
    return 1440;
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
  inputs: GenerationPricingInputs
): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (key === 'pricePerImage') {
      return true;
    }
    if (key === 'image_size') {
      return imageSizesMatch(value, inputs.imageSize);
    }
    if (key === 'quality') {
      return Object.is(inputs.quality, value);
    }
    return rowInputValue(inputs, key) === value;
  });
}

function nearestCustomImageSizeRow(
  rows: Array<Record<string, unknown>>,
  inputs: GenerationPricingInputs
): Record<string, unknown> | null {
  const inputSize = readImageSizeDimensions(inputs.imageSize);
  if (!inputSize || typeof inputs.imageSize !== 'object') {
    return null;
  }
  let best: { row: Record<string, unknown>; distance: number } | null = null;
  for (const row of rows) {
    if (!nonImageSizePriceFieldsMatch(row, inputs)) {
      continue;
    }
    const rowSize = readImageSizeDimensions(row.image_size);
    if (!rowSize) {
      continue;
    }
    const distance = Math.abs(pixelArea(rowSize) - pixelArea(inputSize));
    if (!best || distance < best.distance) {
      best = { row, distance };
    }
  }
  return best?.row ?? null;
}

function nonImageSizePriceFieldsMatch(
  row: Record<string, unknown>,
  inputs: GenerationPricingInputs
): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (key === 'pricePerImage' || key === 'image_size') {
      return true;
    }
    return Object.is(rowInputValue(inputs, key), value);
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

function rowMatches(
  row: Record<string, unknown>,
  inputs: Record<string, unknown>
): boolean {
  return Object.entries(row).every(([key, value]) => {
    if (key.startsWith('pricePer')) {
      return true;
    }
    if (key === 'uses_voice_control' && value === false) {
      return inputs[key] === false || inputs[key] === undefined;
    }
    return Object.is(inputs[key], value);
  });
}

function rowInputValue(
  inputs: GenerationPricingInputs,
  key: string
): unknown {
  if (key === 'image_size') {
    return inputs.imageSize;
  }
  if (key === 'resolution') {
    return inputs.resolution;
  }
  if (key === 'quality') {
    return inputs.quality;
  }
  if (key === 'aspect_ratio') {
    return inputs.aspectRatio;
  }
  if (key === 'generate_audio') {
    return inputs.generateAudio;
  }
  if (key === 'uses_voice_control') {
    return inputs.usesVoiceControl;
  }
  if (key === 'mode') {
    return inputs.mode;
  }
  return undefined;
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

function seconds(value: unknown): number {
  return readPositiveSeconds(value) ?? 1;
}

function readPositiveSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const secondsMatch = /^(\d+(?:\.\d+)?)s$/.exec(trimmed);
    const parsed = Number(secondsMatch?.[1] ?? trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function characterCount(inputs: GenerationPricingInputs): number {
  return normalizedNonNegativeCount(inputs.characterCount ?? 0);
}

function inputImageCost(
  pricing: ModelPriceConfig,
  inputs: GenerationPricingInputs,
  outputCount: number
): number {
  if (typeof pricing.pricePerInputImage !== 'number') {
    return 0;
  }
  return pricing.pricePerInputImage * inputImageCount(inputs) * outputCount;
}

function inputImageCount(inputs: GenerationPricingInputs): number {
  return normalizedNonNegativeCount(inputs.inputImageCount ?? 0);
}

function normalizedOutputCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

function normalizedNonNegativeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function stableStringify(input: unknown): string {
  return JSON.stringify(sortForHash(input));
}

function sortForHash(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(sortForHash);
  }
  if (!input || typeof input !== 'object') {
    return input;
  }
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, sortForHash(value)])
  );
}
