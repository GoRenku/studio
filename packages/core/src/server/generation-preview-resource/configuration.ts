import type {
  GenerationModelDescriptor,
  GenerationModelFieldDescriptor,
  GenerationPreview,
  JsonValue,
} from '../../client/generation.js';
import type {
  GenerationEditorControl,
  GenerationPreviewAuthoring,
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

export function projectGenerationPreviewAuthoring(
  preview: GenerationPreview,
): GenerationPreviewAuthoring {
  return {
    models: (preview.models ?? []).map((model) => ({
      provider: model.provider,
      modelId: model.model,
      label: model.label,
      controls: model.fields.flatMap((field) =>
        editorControl(preview, model, field)
      ),
    })),
  };
}

function editorControl(
  preview: GenerationPreview,
  model: GenerationModelDescriptor,
  field: GenerationModelFieldDescriptor,
): GenerationEditorControl[] {
  if (field.media || field.semantic?.kind === 'authored-text') {
    return [];
  }
  const currentModel =
    preview.spec.model?.provider === model.provider &&
    preview.spec.model?.model === model.model;
  const authored =
    currentModel && preview.spec.values[field.name] !== undefined;
  const recommendation = recommendedValue(preview, field);
  const recommended = !authored && recommendation !== undefined;
  const value = authored
    ? configurationValue(preview.spec.values[field.name]) ?? null
    : recommendation ??
      configurationValue(field.defaultValue) ??
      null;
  if (field.allowedValues?.length) {
    return [{
      controlId: field.name,
      kind: 'select',
      label: field.label,
      value,
      required: field.required,
      authored,
      recommended,
      options: field.allowedValues.map((option) => ({
        label: String(option),
        value: option,
      })),
    }];
  }
  if (
    field.kind === 'integer' ||
    field.kind === 'number' ||
    typeof value === 'number'
  ) {
    return [{
      controlId: field.name,
      kind: 'number',
      label: field.label,
      value: typeof value === 'number' ? value : null,
      required: field.required,
      authored,
      recommended,
      ...(field.minimum !== undefined ? { min: field.minimum } : {}),
      ...(field.maximum !== undefined ? { max: field.maximum } : {}),
    }];
  }
  if (field.kind === 'boolean' || typeof value === 'boolean') {
    return [{
      controlId: field.name,
      kind: 'toggle',
      label: field.label,
      value: typeof value === 'boolean' ? value : false,
      required: field.required,
      authored,
      recommended,
    }];
  }
  if (
    field.kind === 'string' ||
    typeof value === 'string'
  ) {
    return [{
      controlId: field.name,
      kind: 'text',
      label: field.label,
      value: typeof value === 'string' ? value : null,
      required: field.required,
      authored,
      recommended,
    }];
  }
  return [{
    controlId: field.name,
    kind: 'readonly',
    label: field.label,
    value,
    authored,
    recommended,
  }];
}

function recommendedValue(
  preview: GenerationPreview,
  field: GenerationModelFieldDescriptor,
): GenerationPreviewConfigurationValue | undefined {
  if (!field.productSettingKind || !field.productSettingValues) {
    return undefined;
  }
  const setting = preview.settings?.recommended.find(
    (candidate) => candidate.kind === field.productSettingKind
  );
  if (typeof setting?.value !== 'string') {
    return undefined;
  }
  return configurationValue(field.productSettingValues[setting.value]);
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
