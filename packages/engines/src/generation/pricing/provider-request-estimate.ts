import type { LoadedModelCatalog } from '../../model-catalog.js';
import type {
  GenerationCostEstimate,
  GenerationMediaKind,
  GenerationPricingInputs,
} from '../contracts.js';
import { describeGenerationModelInputs } from '../catalog/model-input-descriptors.js';
import { estimateGenerationCost } from './estimate-generation-cost.js';

export async function estimateGenerationProviderRequest(input: {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  payload: Record<string, unknown>;
  inputMediaCounts?: Partial<Record<'image' | 'audio' | 'video', number>>;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationCostEstimate> {
  const descriptor = await describeGenerationModelInputs({
    provider: input.provider,
    model: input.model,
    ...(input.catalog ? { catalog: input.catalog } : {}),
  });
  const aspectRatioField = descriptor?.fields.find(
    (field) => field.productSettingKind === 'aspect-ratio'
  );
  const qualityField = descriptor?.fields.find(
    (field) => field.productSettingKind === 'quality'
  );
  const effectivePayload = providerPricingValues(
    input.payload,
    descriptor?.fields ?? []
  );
  const pricingInputs: GenerationPricingInputs = {
    outputCount: firstNumber(effectivePayload, [
      'num_images',
      'num_outputs',
      'output_count',
      'n',
    ]),
    durationSeconds: firstNumberOrString(effectivePayload, [
      'duration',
      'duration_seconds',
      'length_seconds',
    ]),
    characterCount: authoredTextLength(effectivePayload),
    imageSize: firstStringOrDimensions(effectivePayload, [
      'image_size',
      'size',
    ]),
    resolution: firstString(effectivePayload, ['resolution']),
    aspectRatio: aspectRatioField
      ? scalarString(effectivePayload[aspectRatioField.name])
      : undefined,
    quality: qualityField
      ? scalarString(effectivePayload[qualityField.name])
      : undefined,
    generateAudio: firstBoolean(effectivePayload, ['generate_audio']),
    usesVoiceControl: hasAnyField(effectivePayload, [
      'voice_ids',
      'voice_id',
      'voice_control',
    ]),
    mode: firstString(effectivePayload, ['mode']),
    inputImageCount: input.inputMediaCounts?.image,
    inputAudioCount: input.inputMediaCounts?.audio,
    inputVideoCount: input.inputMediaCounts?.video,
  };
  return estimateGenerationCost({
    priceKey: {
      provider: input.provider,
      model: input.model,
      mediaKind: input.mediaKind,
    },
    pricingInputs,
    ...(input.catalog ? { catalog: input.catalog } : {}),
  });
}

function providerPricingValues(
  payload: Record<string, unknown>,
  fields: Array<{
    name: string;
    defaultValue?: unknown;
    media?: unknown;
  }>
): Record<string, unknown> {
  const values = { ...payload };
  for (const field of fields) {
    if (
      !field.media &&
      !Object.hasOwn(values, field.name) &&
      field.defaultValue !== undefined
    ) {
      values[field.name] = field.defaultValue;
    }
  }
  return values;
}

function firstNumber(
  payload: Record<string, unknown>,
  names: string[]
): number | undefined {
  for (const name of names) {
    if (typeof payload[name] === 'number') {
      return payload[name];
    }
  }
  return undefined;
}

function firstNumberOrString(
  payload: Record<string, unknown>,
  names: string[]
): number | string | undefined {
  for (const name of names) {
    if (typeof payload[name] === 'number' || typeof payload[name] === 'string') {
      return payload[name];
    }
  }
  return undefined;
}

function firstString(
  payload: Record<string, unknown>,
  names: string[]
): string | undefined {
  for (const name of names) {
    if (typeof payload[name] === 'string') {
      return payload[name];
    }
  }
  return undefined;
}

function firstStringOrDimensions(
  payload: Record<string, unknown>,
  names: string[]
): string | { width: number; height: number } | undefined {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === 'string') {
      return value;
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { width?: unknown }).width === 'number' &&
      typeof (value as { height?: unknown }).height === 'number'
    ) {
      return value as { width: number; height: number };
    }
  }
  return undefined;
}

function firstBoolean(
  payload: Record<string, unknown>,
  names: string[]
): boolean | undefined {
  for (const name of names) {
    if (typeof payload[name] === 'boolean') {
      return payload[name];
    }
  }
  return undefined;
}

function scalarString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function authoredTextLength(payload: Record<string, unknown>): number | undefined {
  const text = firstString(payload, ['text', 'prompt']);
  return text?.length;
}

function hasAnyField(payload: Record<string, unknown>, names: string[]): boolean {
  return names.some((name) => Object.hasOwn(payload, name));
}
