import type { StudioImageModelRouteProfile } from '@gorenku/studio-engines';
import type {
  GenerationModelDescriptor,
  GenerationModelFieldDescriptor,
  GenerationPreview,
  JsonValue,
} from '../../client/generation.js';
import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
} from '../../client/generation-preview-resource.js';
import { ProjectDataError } from '../project-data-error.js';

export function projectStudioImageControls(input: {
  preview: GenerationPreview;
  model: GenerationModelDescriptor;
  route: StudioImageModelRouteProfile;
}): GenerationEditorControl[] {
  const fields = new Map(input.model.fields.map((field) => [field.name, field]));
  return input.route.userConfigurableParameters.map((parameter) => {
    const field = fields.get(parameter.field);
    if (!field) {
      throw invalidParameter(parameter.field, 'is not present in the resolved model schema');
    }
    return editorControl({
      preview: input.preview,
      model: input.model,
      field,
      label: parameter.label,
      valueLabels: parameter.valueLabels,
    });
  });
}

export function validatedStudioImageParameterValues(input: {
  route: StudioImageModelRouteProfile;
  model: GenerationModelDescriptor;
  parameterValues: Record<string, JsonValue>;
}): Record<string, JsonValue> {
  const declared = new Set(
    input.route.userConfigurableParameters.map((parameter) => parameter.field),
  );
  const fields = new Map(input.model.fields.map((field) => [field.name, field]));
  const values: Record<string, JsonValue> = {};
  for (const [name, value] of Object.entries(input.parameterValues)) {
    const field = fields.get(name);
    if (!declared.has(name) || !field) {
      throw invalidParameter(name, 'is not user-configurable on the resolved image route');
    }
    if (value === null) {
      continue;
    }
    validateFieldValue(field, value);
    values[name] = value;
  }
  return values;
}

function editorControl(input: {
  preview: GenerationPreview;
  model: GenerationModelDescriptor;
  field: GenerationModelFieldDescriptor;
  label: string;
  valueLabels?: Record<string, string>;
}): GenerationEditorControl {
  const currentModel = input.preview.spec.model?.provider === input.model.provider &&
    input.preview.spec.model?.model === input.model.model;
  const authored = currentModel && input.preview.spec.values[input.field.name] !== undefined;
  const recommendation = recommendedValue(input.preview, input.field);
  const recommended = !authored && recommendation !== undefined;
  const value = authored
    ? configurationValue(input.preview.spec.values[input.field.name]) ?? null
    : recommendation ?? configurationValue(input.field.defaultValue) ?? null;
  if (input.field.allowedValues?.length) {
    return {
      controlId: input.field.name,
      kind: 'select',
      label: input.label,
      value,
      required: input.field.required,
      authored,
      recommended,
      options: input.field.allowedValues.map((option) => ({
        label: input.valueLabels?.[String(option)] ?? String(option),
        value: option,
      })),
    };
  }
  if (input.field.kind === 'number' || input.field.kind === 'integer') {
    return {
      controlId: input.field.name,
      kind: 'number',
      label: input.label,
      value: typeof value === 'number' ? value : null,
      required: input.field.required,
      authored,
      recommended,
      ...(input.field.minimum !== undefined ? { min: input.field.minimum } : {}),
      ...(input.field.maximum !== undefined ? { max: input.field.maximum } : {}),
    };
  }
  if (input.field.kind === 'boolean') {
    return {
      controlId: input.field.name,
      kind: 'toggle',
      label: input.label,
      value: typeof value === 'boolean' ? value : false,
      required: input.field.required,
      authored,
      recommended,
    };
  }
  return {
    controlId: input.field.name,
    kind: 'text',
    label: input.label,
    value: typeof value === 'string' ? value : null,
    required: input.field.required,
    authored,
    recommended,
  };
}

function validateFieldValue(field: GenerationModelFieldDescriptor, value: JsonValue): void {
  if (field.allowedValues?.length &&
      !field.allowedValues.some((allowed) => allowed === value)) {
    throw invalidParameter(field.name, `does not accept ${JSON.stringify(value)}`);
  }
  if ((field.kind === 'number' || field.kind === 'integer') && typeof value !== 'number') {
    throw invalidParameter(field.name, 'requires a number');
  }
  if (field.kind === 'integer' && typeof value === 'number' && !Number.isInteger(value)) {
    throw invalidParameter(field.name, 'requires an integer');
  }
  if (typeof value === 'number' && field.minimum !== undefined && value < field.minimum) {
    throw invalidParameter(field.name, `must be at least ${field.minimum}`);
  }
  if (typeof value === 'number' && field.maximum !== undefined && value > field.maximum) {
    throw invalidParameter(field.name, `must be at most ${field.maximum}`);
  }
  if (field.kind === 'boolean' && typeof value !== 'boolean') {
    throw invalidParameter(field.name, 'requires a boolean');
  }
  if (field.kind === 'string' && typeof value !== 'string') {
    throw invalidParameter(field.name, 'requires text');
  }
}

function recommendedValue(
  preview: GenerationPreview,
  field: GenerationModelFieldDescriptor,
): GenerationPreviewConfigurationValue | undefined {
  if (!field.productSettingKind || !field.productSettingValues) {
    return undefined;
  }
  const setting = preview.settings?.recommended.find(
    (candidate) => candidate.kind === field.productSettingKind,
  );
  return typeof setting?.value === 'string'
    ? configurationValue(field.productSettingValues[setting.value])
    : undefined;
}

function configurationValue(
  value: JsonValue | undefined,
): GenerationPreviewConfigurationValue | undefined {
  if (value === undefined || value === null || typeof value === 'string' ||
      typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function invalidParameter(field: string, reason: string): ProjectDataError {
  return new ProjectDataError(
    'CORE_GENERATION_IMAGE_PARAMETER_INVALID',
    `Image generation parameter ${field} ${reason}.`,
  );
}
