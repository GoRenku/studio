import type {
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakeParameterReport,
} from '@gorenku/studio-core/client';

/**
 * Pure projection helpers for the AI Production tab (0041). Input-mode
 * availability, model status reasons, and enabled parameters are derived here
 * from core reports so the components stay thin. No hooks, services, or fetch.
 */

export const SHOT_VIDEO_TAKE_INPUT_MODE_IDS: ShotVideoTakeInputModeId[] = [
  'text-only',
  'first-frame',
  'first-last-frame',
  'reference',
];

const INPUT_MODE_LABELS: Partial<Record<ShotVideoTakeInputModeId, string>> = {
  'text-only': 'Text only',
  'first-frame': 'First frame',
  'first-last-frame': 'First + last frame',
  reference: 'Reference',
};

const INPUT_MODE_UNAVAILABLE_REASON: Partial<Record<ShotVideoTakeInputModeId, string>> = {
  'text-only': 'No text-only support',
  'first-frame': 'No first frame',
  'first-last-frame': 'No first/last frame',
  reference: 'No reference input',
};

export interface InputModeOption {
  id: ShotVideoTakeInputModeId;
  label: string;
  enabled: boolean;
  disabledTooltip: string | null;
}

export function buildInputModeOptions(): InputModeOption[] {
  return SHOT_VIDEO_TAKE_INPUT_MODE_IDS.map((id) => ({
    id,
    label: INPUT_MODE_LABELS[id] ?? id,
    enabled: true,
    disabledTooltip: null,
  }));
}

export function findModelReport(
  models: ShotVideoTakeModelListReport,
  modelChoice: ShotVideoTakeModelChoice | undefined
): ShotVideoTakeModelChoiceReport | null {
  if (!modelChoice) {
    return null;
  }
  return (
    models.models.find((model) => model.modelChoice === modelChoice) ?? null
  );
}

function durationLabel(model: ShotVideoTakeModelChoiceReport): string {
  if (!model.duration.supported) {
    return '—';
  }
  if (model.duration.values && model.duration.values.length > 0) {
    return formatDurationValues(model.duration.values);
  }
  if (
    model.duration.minimum !== undefined &&
    model.duration.maximum !== undefined
  ) {
    return `${model.duration.minimum}-${model.duration.maximum}s`;
  }
  if (model.duration.default !== undefined) {
    return `${model.duration.default}s`;
  }
  return '—';
}

function formatDurationValues(values: number[]): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return '—';
  }
  if (sorted.length === 1) {
    return `${sorted[0]}s`;
  }
  const isContinuous = sorted.every(
    (value, index) => index === 0 || value === sorted[index - 1] + 1
  );
  if (isContinuous) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}s`;
  }
  return `${sorted.slice(0, -1).join(', ')}, ${sorted[sorted.length - 1]}s`;
}

export interface ModelRow {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  duration: string;
  available: boolean;
  status: string;
  statusTitle: string | null;
}

/**
 * Model table rows for the selected input mode. The visible status stays
 * compact; full unavailable reasons are exposed as metadata so they do not
 * stretch the row.
 */
export function buildModelRows(
  models: ShotVideoTakeModelListReport,
  selectedInputMode: ShotVideoTakeInputModeId
): ModelRow[] {
  return models.models.map((model) => {
    const supportsInputMode = model.supportedInputModes.includes(selectedInputMode);
    const available = model.available && supportsInputMode;
    const unavailableReason =
      model.unavailableReason && !supportsInputMode
        ? (INPUT_MODE_UNAVAILABLE_REASON[selectedInputMode] ?? 'Unavailable')
        : !supportsInputMode
          ? (INPUT_MODE_UNAVAILABLE_REASON[selectedInputMode] ?? 'Unavailable')
          : (model.unavailableReason ?? 'Unavailable');
    return {
      modelChoice: model.modelChoice,
      label: model.label,
      duration: durationLabel(model),
      available,
      status: available
        ? model.estimateInputs.requiresPreparedInputs
          ? 'Input required'
          : 'Ready'
        : 'Unavailable',
      statusTitle: available
        ? model.estimateInputs.requiresPreparedInputs
          ? 'The selected input mode needs a prepared input, such as a first frame or reference image.'
          : null
        : unavailableReason,
    };
  });
}

/** Parameters valid for the current model and selected input mode. */
export function enabledParameters(
  model: ShotVideoTakeModelChoiceReport | null
): ShotVideoTakeParameterReport[] {
  return model?.parameters ?? [];
}

/** Format a USD estimate for display, or `—` when unknown. */
export function formatEstimateUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function defaultModelForInputMode(
  models: ShotVideoTakeModelListReport,
  inputMode: ShotVideoTakeInputModeId
): ShotVideoTakeModelChoice | undefined {
  const defaultModel = models.models.find(
    (model) =>
      model.modelChoice === models.defaultModelChoice &&
      model.available &&
      model.supportedInputModes.includes(inputMode)
  );
  if (defaultModel) {
    return defaultModel.modelChoice;
  }
  const match = models.models.find(
    (model) => model.available && model.supportedInputModes.includes(inputMode)
  );
  return match?.modelChoice;
}
