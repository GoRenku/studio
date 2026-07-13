import type {
  GenerationModelDescriptor,
  GenerationModelFieldDescriptor,
  GenerationPreview,
  JsonValue,
} from '../../client/generation.js';
import type {
  GenerationPreviewConfiguration,
  GenerationPreviewConfigurationRow,
  GenerationPreviewConfigurationValue,
} from '../../client/generation-preview-resource.js';

export function projectGenerationPreviewConfiguration(input: {
  preview: GenerationPreview;
  model?: GenerationModelDescriptor;
}): GenerationPreviewConfiguration {
  const model = input.model;
  if (!model) {
    return { sections: [] };
  }
  const rows = model.fields.flatMap((field) => {
    if (field.media || field.semantic?.kind === 'authored-text') {
      return [];
    }
    const authored = input.preview.spec.values[field.name];
    const value = configurationValue(
      authored === undefined ? field.defaultValue : authored
    );
    return value === undefined
      ? []
      : [configurationRow(field, value, authored !== undefined)];
  });
  return {
    sections: [
      {
        key: 'model',
        label: 'Model',
        rows: [
          {
            key: 'model',
            label: 'Model',
            value: `${model.provider}/${model.model}`,
            valueLabel: model.label,
            source: 'model-capability',
            emphasis: 'primary',
          },
        ],
      },
      ...(rows.length > 0
        ? [{ key: 'model-inputs', label: 'Model inputs', rows }]
        : []),
    ],
  };
}

function configurationRow(
  field: GenerationModelFieldDescriptor,
  value: GenerationPreviewConfigurationValue,
  authored: boolean
): GenerationPreviewConfigurationRow {
  return {
    key: field.name,
    label: field.label,
    value,
    providerField: field.name,
    ...(field.defaultValue !== undefined
      ? { schemaDefault: configurationValue(field.defaultValue) }
      : {}),
    ...(field.allowedValues
      ? { allowedValues: field.allowedValues }
      : {}),
    ...(field.minimum !== undefined ? { minimum: field.minimum } : {}),
    ...(field.maximum !== undefined ? { maximum: field.maximum } : {}),
    required: field.required,
    source: authored ? 'spec' : 'provider-default',
    emphasis: 'primary',
    presentation: 'parameter-control',
  };
}

function configurationValue(
  value: JsonValue | undefined
): GenerationPreviewConfigurationValue | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean'
    )
  ) {
    return value as Array<string | number | boolean>;
  }
  if (
    !Array.isArray(value) &&
    value.kind === 'dimensions' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  ) {
    return {
      kind: 'dimensions',
      width: value.width,
      height: value.height,
    };
  }
  return undefined;
}
