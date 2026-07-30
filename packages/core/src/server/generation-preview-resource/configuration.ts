import {
  readStudioImageModelFamily,
  readStudioImageModelRouteProfile,
  readStudioVideoModelFamily,
  readStudioVideoModelRouteProfile,
} from '@gorenku/studio-engines';
import type {
  GenerationModelDescriptor,
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
import { readStudioImageModelFamilyId } from '../generation/image-model-authoring.js';
import { readStudioVideoModelFamilyId } from '../generation/shot-plan-video-model-authoring.js';
import { readGenerationPreviewAuthoringStrategy } from './authoring-strategies/registry.js';

export async function projectGenerationPreviewConfiguration(input: {
  preview: GenerationPreview;
  authoring: GenerationPreviewAuthoring;
}): Promise<GenerationPreviewConfiguration> {
  if (input.preview.spec.executionKind === 'agent-external') {
    return await savedConfiguration(input.preview);
  }
  if (input.authoring.kind === 'none') {
    return await savedConfiguration(input.preview);
  }
  const authoring = input.authoring;
  const family = authoring.modelFamilies.find((candidate) =>
    candidate.familyId === authoring.selectedModelFamilyId
  );
  if (!family && !authoring.selectedModelFamilyId) {
    return await savedConfiguration(input.preview);
  }
  return {
    sections: [
      {
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: authoring.selectedModelFamilyId,
          ...(family ? { valueLabel: family.label } : {}),
          source: 'model-capability',
          emphasis: 'primary',
        }],
      },
      ...(authoring.controls.length > 0
        ? [{
            key: 'model-inputs',
            label: 'Configuration',
            rows: authoring.controls.map(configurationRow),
          }]
        : []),
    ],
  };
}

export async function projectGenerationPreviewAuthoring(input: {
  preview: GenerationPreview;
  model?: GenerationModelDescriptor;
}): Promise<GenerationPreviewAuthoring> {
  const mediaKind = input.preview.spec.executionKind === 'agent-external'
    ? null
    : input.model?.mediaKind ??
      input.preview.models?.[0]?.mediaKind ??
      null;
  return readGenerationPreviewAuthoringStrategy(mediaKind).project(input);
}

function configurationRow(
  control: GenerationEditorControl,
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

async function savedConfiguration(
  preview: GenerationPreview,
): Promise<GenerationPreviewConfiguration> {
  const routeIdentity = preview.spec.model?.provider && preview.spec.model.model
    ? {
        provider: preview.spec.model.provider,
        model: preview.spec.model.model,
      }
    : null;
  const [modelFamilyId, route] = await Promise.all([
    preview.spec.purpose === 'shot-plan.video-generation'
      ? readStudioVideoModelFamilyId(preview.spec.model)
      : readStudioImageModelFamilyId(preview.spec.model),
    routeIdentity
      ? preview.spec.purpose === 'shot-plan.video-generation'
        ? readStudioVideoModelRouteProfile(routeIdentity)
        : readStudioImageModelRouteProfile(routeIdentity)
      : Promise.resolve(null),
  ]);
  const family = modelFamilyId
    ? preview.spec.purpose === 'shot-plan.video-generation'
      ? await readStudioVideoModelFamily(modelFamilyId)
      : await readStudioImageModelFamily(modelFamilyId)
    : null;
  const modelIdentity = [preview.spec.model?.provider, preview.spec.model?.model]
    .filter(Boolean)
    .join('/');
  const rows: GenerationPreviewConfigurationRow[] = route
    ? route.userConfigurableParameters.flatMap((parameter) => {
        const value = preview.spec.values[parameter.field];
        if (value === undefined) {
          return [];
        }
        const valueLabel = parameter.valueLabels?.[String(value)];
        return [{
          key: parameter.field,
          label: parameter.label,
          value: displayValue(value),
          ...(valueLabel ? { valueLabel } : {}),
          providerField: parameter.field,
          source: 'spec' as const,
          emphasis: 'primary' as const,
        }];
      })
    : Object.entries(preview.spec.values).flatMap(([key, value]) =>
        key === 'prompt' ? [] : [{
          key,
          label: externalValueLabel(key),
          value: displayValue(value),
          providerField: key,
          source: 'spec' as const,
          emphasis: 'primary' as const,
        }]
      );
  return {
    sections: [
      ...(modelIdentity ? [{
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: modelIdentity,
          ...(family ? { valueLabel: family.label } : {}),
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
