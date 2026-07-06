import {
  describeGenerationModelInputs,
  loadBundledGenerationCatalog,
  validateGenerationProviderPayload,
  type GenerationModelInputDescriptor,
  type GenerationModelInputFieldDescriptor,
} from '@gorenku/studio-engines';
import type {
  GenerationPreviewConfiguration,
  GenerationPreviewConfigurationRow,
  GenerationPreviewConfigurationValue,
  GenerationPreviewConfigurationValueSource,
} from '../../../client/index.js';
import {
  configurationValueLabel,
  previewConfigurationValue as toPreviewConfigurationValue,
} from './configuration-values.js';

const PROMPT_FIELDS = new Set(['prompt', 'negative_prompt', 'negativePrompt']);

const MEDIA_INPUT_FIELDS = new Set([
  'image_urls',
  'image_url',
  'input_image_url',
  'mask_url',
  'start_image_url',
  'end_image_url',
  'video_url',
  'audio_url',
]);

const PRIMARY_IMAGE_FIELDS = new Set([
  'num_images',
  'image_size',
  'aspect_ratio',
  'quality',
  'resolution',
  'output_format',
  'seed',
]);

export interface BuildImagePreviewConfigurationInput {
  provider: string;
  providerModel: string;
  modelChoice: string;
  modelLabel?: string;
  payload: Record<string, unknown>;
  productRows?: GenerationPreviewConfigurationRow[];
}

export async function buildImagePreviewConfiguration(
  input: BuildImagePreviewConfigurationInput
): Promise<GenerationPreviewConfiguration> {
  const catalog = await loadBundledGenerationCatalog();
  await validateGenerationProviderPayload({
    catalog,
    provider: input.provider,
    model: input.providerModel,
    payload: input.payload,
  });
  const descriptor = await describeGenerationModelInputs({
    catalog,
    provider: input.provider,
    model: input.providerModel,
  });
  const modelRows = modelSectionRows(input);
  const primaryRows = buildSchemaBackedRows({
    descriptor,
    payload: input.payload,
    supportedFields: PRIMARY_IMAGE_FIELDS,
    emphasis: 'primary',
  });
  return {
    sections: [
      {
        key: 'model',
        label: 'Model',
        rows: modelRows,
      },
      ...(primaryRows.length > 0 || input.productRows?.length
        ? [
            {
              key: 'model-inputs',
              label: 'Model inputs',
              rows: [...primaryRows, ...(input.productRows ?? [])],
            },
          ]
        : []),
    ],
  };
}

function modelSectionRows(
  input: BuildImagePreviewConfigurationInput
): GenerationPreviewConfigurationRow[] {
  return [
    {
      key: 'model',
      label: 'Model',
      value: input.modelChoice,
      valueLabel: input.modelLabel ?? input.modelChoice,
      source: 'model-capability',
      emphasis: 'primary',
    },
  ];
}

function buildSchemaBackedRows(input: {
  descriptor: GenerationModelInputDescriptor | null;
  payload: Record<string, unknown>;
  supportedFields: Set<string>;
  emphasis: 'primary' | 'secondary';
}): GenerationPreviewConfigurationRow[] {
  if (!input.descriptor) {
    return [];
  }
  return input.descriptor.fields.flatMap((field) => {
    if (
      PROMPT_FIELDS.has(field.name) ||
      MEDIA_INPUT_FIELDS.has(field.name) ||
      !input.supportedFields.has(field.name)
    ) {
      return [];
    }
    const hasPayloadValue = Object.hasOwn(input.payload, field.name);
    const payloadValue = hasPayloadValue
      ? toPreviewConfigurationValue(input.payload[field.name])
      : undefined;
    const schemaDefault = toPreviewConfigurationValue(field.defaultValue);
    if (payloadValue === undefined && schemaDefault === undefined) {
      return [];
    }
    const value = hasPayloadValue ? payloadValue : schemaDefault;
    if (value === undefined) {
      return [];
    }
    return [
      schemaBackedRow({
        field,
        value,
        source: !hasPayloadValue ? 'provider-default' : 'spec',
        schemaDefault,
        emphasis: input.emphasis,
      }),
    ];
  });
}

function schemaBackedRow(input: {
  field: GenerationModelInputFieldDescriptor;
  value: GenerationPreviewConfigurationValue;
  source: GenerationPreviewConfigurationValueSource;
  schemaDefault: GenerationPreviewConfigurationValue | undefined;
  emphasis: 'primary' | 'secondary';
}): GenerationPreviewConfigurationRow {
  return {
    key: input.field.name,
    label: input.field.label,
    value: input.value,
    valueLabel: configurationValueLabel(input.value),
    providerField: input.field.name,
    ...(input.schemaDefault !== undefined
      ? {
          schemaDefault: input.schemaDefault,
          schemaDefaultLabel: configurationValueLabel(input.schemaDefault),
        }
      : {}),
    ...(input.field.allowedValues
      ? {
          allowedValues: input.field.allowedValues.map((value) =>
            toPreviewConfigurationValue(value)
          ).filter((value): value is GenerationPreviewConfigurationValue => value !== undefined),
        }
      : {}),
    ...(input.field.minimum !== undefined ? { minimum: input.field.minimum } : {}),
    ...(input.field.maximum !== undefined ? { maximum: input.field.maximum } : {}),
    required: input.field.required,
    source: input.source,
    emphasis: input.emphasis,
    presentation: input.emphasis === 'primary' ? 'parameter-control' : 'static',
  };
}

export function productMetadataRow(input: {
  key: string;
  label: string;
  value: GenerationPreviewConfigurationValue;
  source?: GenerationPreviewConfigurationValueSource;
}): GenerationPreviewConfigurationRow {
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    valueLabel: configurationValueLabel(input.value),
    source: input.source ?? 'spec',
    emphasis: 'secondary',
  };
}
