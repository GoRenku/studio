import type { GenerationModelInputDescriptor } from './catalog/model-input-descriptors.js';

export interface GenerationSemanticValues {
  prompt?: string;
  negativePrompt?: string;
  duration?: string | number;
  voice?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  };
  outputFormat?: string;
  language?: string | null;
}

export interface GenerationProductSettingInput {
  kind: 'aspect-ratio' | 'quality';
  value: string | number | boolean | null;
}

export type GenerationProductSettingBinding =
  | { valid: true; values: Record<string, string | number | boolean | null> }
  | { valid: false; issues: Array<{ kind: string; message: string }> };

export function bindGenerationProductSettings(input: {
  descriptor: GenerationModelInputDescriptor;
  settings: GenerationProductSettingInput[];
}): GenerationProductSettingBinding {
  const values: Record<string, string | number | boolean | null> = {};
  const issues: Array<{ kind: string; message: string }> = [];
  for (const setting of input.settings) {
    const field = input.descriptor.fields.find(
      (candidate) => candidate.productSettingKind === setting.kind
    );
    if (!field) {
      issues.push({ kind: setting.kind, message: `${input.descriptor.provider}/${input.descriptor.model} cannot represent the ${setting.kind} product setting.` });
      continue;
    }
    const canonical = String(setting.value);
    const value = field.productSettingValues?.[canonical] ??
      (field.allowedValues?.includes(setting.value as never) ? setting.value : undefined);
    if (value === undefined) {
      issues.push({ kind: setting.kind, message: `${input.descriptor.provider}/${input.descriptor.model} cannot represent ${setting.kind}=${canonical}.` });
      continue;
    }
    values[field.name] = value;
  }
  return issues.length > 0 ? { valid: false, issues } : { valid: true, values };
}

export function bindGenerationSemanticValues(input: {
  descriptor: GenerationModelInputDescriptor;
  values: GenerationSemanticValues;
}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of input.descriptor.fields) {
    const semantic = field.semantic;
    if (!semantic) {
      continue;
    }
    if (semantic.kind === 'authored-text') {
      const value = semantic.role === 'prompt'
        ? input.values.prompt
        : input.values.negativePrompt;
      if (value !== undefined) {
        result[field.name] = value;
      }
      continue;
    }
    if (semantic.kind !== 'setting') {
      continue;
    }
    const value = semanticSettingValue(semantic.role, input.values);
    if (value !== undefined && value !== null) {
      result[field.name] = value;
    }
  }
  return result;
}

function semanticSettingValue(
  role: Extract<
    NonNullable<GenerationModelInputDescriptor['fields'][number]['semantic']>,
    { kind: 'setting' }
  >['role'],
  values: GenerationSemanticValues
): unknown {
  switch (role) {
    case 'duration':
      return values.duration;
    case 'voice':
      return values.voice;
    case 'voice-settings':
      return values.voiceSettings
        ? {
            ...(values.voiceSettings.stability !== undefined
              ? { stability: values.voiceSettings.stability }
              : {}),
            ...(values.voiceSettings.similarityBoost !== undefined
              ? { similarity_boost: values.voiceSettings.similarityBoost }
              : {}),
            ...(values.voiceSettings.style !== undefined
              ? { style: values.voiceSettings.style }
              : {}),
            ...(values.voiceSettings.speed !== undefined
              ? { speed: values.voiceSettings.speed }
              : {}),
            ...(values.voiceSettings.useSpeakerBoost !== undefined
              ? { use_speaker_boost: values.voiceSettings.useSpeakerBoost }
              : {}),
          }
        : undefined;
    case 'output-format':
      return values.outputFormat;
    case 'language':
      return values.language;
    case 'aspect-ratio':
    case 'quality':
      return undefined;
  }
}
