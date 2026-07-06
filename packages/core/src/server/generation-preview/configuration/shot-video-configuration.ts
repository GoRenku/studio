import type {
  GenerationPreviewConfiguration,
  GenerationPreviewConfigurationRow,
  GenerationPreviewConfigurationValue,
  GenerationPreviewConfigurationValueSource,
  ShotVideoTakeOutputGenerationSpec,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import type { ShotVideoTakeProviderPlan } from '../../media-generation/purposes/shot-video-take/provider/provider-payloads.js';
import {
  normalizeRouteSettingsForContext,
  parametersForRoute,
  requireShotVideoTakeRoute,
} from '../../media-generation/purposes/shot-video-take/shared/route-settings.js';
import {
  configurationValueLabel,
  previewConfigurationValue,
} from './configuration-values.js';

const PROMPT_FIELDS = new Set(['prompt', 'negative_prompt', 'multi_prompt']);

export function buildShotVideoTakePreviewConfiguration(input: {
  spec: ShotVideoTakeOutputGenerationSpec;
  context: ShotVideoTakeProductionContext;
  plan: ShotVideoTakeProviderPlan;
  modelLabel?: string;
}): GenerationPreviewConfiguration {
  const route = requireShotVideoTakeRoute(
    input.spec.modelChoice,
    input.spec.inputModeId,
    input.context.shotGroupMode
  );
  const normalized = normalizeRouteSettingsForContext({
    context: input.context,
    route,
  });
  const parameterRows = parametersForRoute(route).flatMap((parameter) => {
    if (PROMPT_FIELDS.has(parameter.name)) {
      return [];
    }
    const payloadValue = Object.hasOwn(input.plan.payload, parameter.name)
      ? previewConfigurationValue(input.plan.payload[parameter.name])
      : undefined;
    const normalizedValue = Object.hasOwn(normalized.providerValues, parameter.name)
      ? previewConfigurationValue(normalized.providerValues[parameter.name])
      : undefined;
    const defaultValue = previewConfigurationValue(parameter.defaultValue);
    const value = payloadValue ?? normalizedValue ?? defaultValue;
    if (value === undefined) {
      return [];
    }
    const source = parameterSource({
      spec: input.spec,
      normalizedProviderValues: normalized.providerValues,
      parameterName: parameter.name,
      hasPayloadValue: payloadValue !== undefined,
      hasDefaultValue: defaultValue !== undefined,
    });
    return [
      configurationRow({
        key: parameter.name,
        label: parameter.label,
        value,
        providerField: parameter.name,
        source,
        schemaDefault: defaultValue,
        allowedValues: parameter.allowedValues
          ?.map((allowedValue) => previewConfigurationValue(allowedValue))
          .filter(
            (allowedValue): allowedValue is GenerationPreviewConfigurationValue =>
              allowedValue !== undefined
          ),
        minimum: parameter.minimum,
        maximum: parameter.maximum,
        required: parameter.required,
        emphasis: 'primary',
        presentation: 'parameter-control',
      }),
    ];
  });

  return {
    sections: [
      {
        key: 'model',
        label: 'Model',
        rows: [
          configurationRow({
            key: 'model',
            label: 'Model',
            value: input.spec.modelChoice,
            valueLabel: input.modelLabel ?? input.spec.modelChoice,
            source: 'model-capability',
            emphasis: 'primary',
          }),
          configurationRow({
            key: 'inputMode',
            label: 'Input mode',
            value: input.spec.inputModeId,
            source: 'spec',
            emphasis: 'secondary',
          }),
          configurationRow({
            key: 'providerRoute',
            label: 'Provider route',
            value: route.providerModel,
            source: 'provider-route',
            emphasis: 'secondary',
          }),
        ],
      },
      ...(parameterRows.length > 0
        ? [
            {
              key: 'model-inputs',
              label: 'Model inputs',
              rows: parameterRows,
            },
          ]
        : []),
    ],
  };
}

function parameterSource(input: {
  spec: ShotVideoTakeOutputGenerationSpec;
  normalizedProviderValues: Record<string, unknown>;
  parameterName: string;
  hasPayloadValue: boolean;
  hasDefaultValue: boolean;
}): GenerationPreviewConfigurationValueSource {
  if (Object.hasOwn(input.spec.parameterValues, input.parameterName)) {
    return 'spec';
  }
  if (Object.hasOwn(input.normalizedProviderValues, input.parameterName)) {
    return 'context-default';
  }
  if (input.hasPayloadValue) {
    return 'provider-route';
  }
  return input.hasDefaultValue ? 'provider-default' : 'derived';
}

function configurationRow(input: {
  key: string;
  label: string;
  value: GenerationPreviewConfigurationValue;
  valueLabel?: string;
  providerField?: string;
  source: GenerationPreviewConfigurationValueSource;
  schemaDefault?: GenerationPreviewConfigurationValue;
  allowedValues?: GenerationPreviewConfigurationValue[];
  minimum?: number;
  maximum?: number;
  required?: boolean;
  emphasis: 'primary' | 'secondary';
  presentation?: 'static' | 'parameter-control';
}): GenerationPreviewConfigurationRow {
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    valueLabel: input.valueLabel ?? configurationValueLabel(input.value),
    ...(input.providerField ? { providerField: input.providerField } : {}),
    ...(input.schemaDefault !== undefined
      ? {
          schemaDefault: input.schemaDefault,
          schemaDefaultLabel: configurationValueLabel(input.schemaDefault),
        }
      : {}),
    ...(input.allowedValues ? { allowedValues: input.allowedValues } : {}),
    ...(input.minimum !== undefined ? { minimum: input.minimum } : {}),
    ...(input.maximum !== undefined ? { maximum: input.maximum } : {}),
    ...(input.required !== undefined ? { required: input.required } : {}),
    source: input.source,
    emphasis: input.emphasis,
    presentation: input.presentation ?? 'static',
  };
}
