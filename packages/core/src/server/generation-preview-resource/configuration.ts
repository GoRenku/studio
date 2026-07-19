import { readStudioImageModelRouteProfile } from '@gorenku/studio-engines';
import type {
  GenerationModelDescriptor,
  GenerationPreview,
  JsonValue,
} from '../../client/generation.js';
import type {
  GenerationPreviewAuthoring,
  GenerationPreviewConfiguration,
  GenerationPreviewConfigurationRow,
  GenerationPreviewConfigurationValue,
} from '../../client/generation-preview-resource.js';
import {
  listAvailableStudioImageModelFamilies,
  readStudioImageModelFamilyId,
} from '../generation/image-model-authoring.js';
import { projectStudioImageControls } from '../generation/image-configurable-values.js';

export function projectGenerationPreviewConfiguration(input: {
  preview: GenerationPreview;
  authoring: GenerationPreviewAuthoring;
}): GenerationPreviewConfiguration {
  if (input.preview.spec.executionKind === 'agent-external') {
    return externalConfiguration(input.preview);
  }
  const family = input.authoring.modelFamilies.find((candidate) =>
    candidate.familyId === input.authoring.selectedModelFamilyId
  );
  return {
    sections: [
      {
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: input.authoring.selectedModelFamilyId,
          ...(family ? { valueLabel: family.label } : {}),
          source: 'model-capability',
          emphasis: 'primary',
        }],
      },
      ...(input.authoring.controls.length > 0
        ? [{
            key: 'model-inputs',
            label: 'Configuration',
            rows: input.authoring.controls.map(configurationRow),
          }]
        : []),
    ],
  };
}

export async function projectGenerationPreviewAuthoring(input: {
  preview: GenerationPreview;
  model?: GenerationModelDescriptor;
}): Promise<GenerationPreviewAuthoring> {
  if (input.preview.spec.executionKind === 'agent-external' || !input.model) {
    return { selectedModelFamilyId: '', modelFamilies: [], controls: [] };
  }
  const [families, selectedModelFamilyId, route] = await Promise.all([
    listAvailableStudioImageModelFamilies(input.preview.models ?? []),
    readStudioImageModelFamilyId(input.preview.spec.model),
    readStudioImageModelRouteProfile({
      provider: input.model.provider,
      model: input.model.model,
    }),
  ]);
  if (!selectedModelFamilyId || !route) {
    return { selectedModelFamilyId: '', modelFamilies: [], controls: [] };
  }
  return {
    selectedModelFamilyId,
    modelFamilies: families.map((family) => ({
      familyId: family.id,
      label: family.label,
    })),
    controls: projectStudioImageControls({
      preview: input.preview,
      model: input.model,
      route,
    }),
  };
}

function configurationRow(
  control: GenerationPreviewAuthoring['controls'][number],
): GenerationPreviewConfigurationRow {
  return {
    key: control.controlId,
    label: control.label,
    value: control.value,
    required: control.kind === 'readonly' ? false : control.required,
    source: control.authored ? 'spec' : 'provider-default',
    emphasis: 'primary',
    presentation: 'parameter-control',
    ...(control.kind === 'select'
      ? {
          allowedValues: control.options.map((option) => option.value),
          allowedValueLabels: Object.fromEntries(control.options.map((option) => [
            String(option.value),
            option.label,
          ])),
        }
      : {}),
    ...(control.kind === 'number' && control.min !== undefined
      ? { minimum: control.min }
      : {}),
    ...(control.kind === 'number' && control.max !== undefined
      ? { maximum: control.max }
      : {}),
  };
}

function externalConfiguration(
  preview: GenerationPreview,
): GenerationPreviewConfiguration {
  const modelIdentity = [preview.spec.model?.provider, preview.spec.model?.model]
    .filter(Boolean)
    .join('/');
  const rows: GenerationPreviewConfigurationRow[] = Object.entries(
    preview.spec.values,
  ).flatMap(([key, value]) => key === 'prompt' ? [] : [{
    key,
    label: externalValueLabel(key),
    value: displayValue(value),
    providerField: key,
    source: 'spec' as const,
    emphasis: 'primary' as const,
  }]);
  return {
    sections: [
      ...(modelIdentity ? [{
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: modelIdentity,
          source: 'spec' as const,
          emphasis: 'primary' as const,
        }],
      }] : []),
      ...(rows.length ? [{ key: 'inputs', label: 'Saved values', rows }] : []),
    ],
  };
}

function displayValue(value: JsonValue): GenerationPreviewConfigurationValue {
  if (!Array.isArray(value) && typeof value === 'object' && value !== null &&
      Object.keys(value).length === 2 && typeof value.width === 'number' &&
      typeof value.height === 'number') {
    return { kind: 'dimensions', width: value.width, height: value.height };
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' ||
      typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
}

function externalValueLabel(key: string): string {
  const label = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return label ? `${label[0]!.toUpperCase()}${label.slice(1)}` : key;
}
