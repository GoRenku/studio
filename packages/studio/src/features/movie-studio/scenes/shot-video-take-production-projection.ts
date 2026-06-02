import type {
  ShotVideoTakeIntentId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelChoiceReport,
  ShotVideoTakeModelListReport,
  ShotVideoTakeParameterReport,
} from '@gorenku/studio-core/client';

/**
 * Pure projection helpers for the AI Production tab (0041). Intent gating,
 * model availability, status reasons, and enabled parameters are derived here
 * from core reports so the components stay thin. No hooks, services, or fetch.
 */

export const SHOT_VIDEO_TAKE_INTENT_IDS: ShotVideoTakeIntentId[] = [
  'text-only',
  'first-frame',
  'first-last-frame',
  'reference',
  'multi-shot',
];

const INTENT_LABELS: Partial<Record<ShotVideoTakeIntentId, string>> = {
  'text-only': 'Text only',
  'first-frame': 'First frame',
  'first-last-frame': 'First + last frame',
  reference: 'Reference',
  'multi-shot': 'Multi-shot',
};

const MULTI_SHOT_DISABLED_TOOLTIP =
  'Select adjacent shots in the rail to use multi-shot generation.';
const SINGLE_SHOT_DISABLED_TOOLTIP =
  'Multi-shot group selected. Split the group to use this intent.';

const INTENT_UNAVAILABLE_REASON: Partial<Record<ShotVideoTakeIntentId, string>> = {
  'text-only': 'No text-only support',
  'first-frame': 'No first frame',
  'first-last-frame': 'No first/last frame',
  reference: 'No reference input',
  'multi-shot': 'No multi-shot support',
};

export interface IntentOption {
  id: ShotVideoTakeIntentId;
  label: string;
  enabled: boolean;
  disabledTooltip: string | null;
}

/**
 * Intent gating follows group size. Disabled intents stay visible; no
 * dependency counts or badges appear.
 */
export function buildIntentOptions(groupShotCount: number): IntentOption[] {
  const isMultiShot = groupShotCount > 1;
  return SHOT_VIDEO_TAKE_INTENT_IDS.map((id) => {
    if (isMultiShot) {
      const enabled = id === 'multi-shot';
      return {
        id,
        label: INTENT_LABELS[id] ?? id,
        enabled,
        disabledTooltip: enabled ? null : SINGLE_SHOT_DISABLED_TOOLTIP,
      };
    }
    const enabled = id !== 'multi-shot';
    return {
      id,
      label: INTENT_LABELS[id] ?? id,
      enabled,
      disabledTooltip: enabled ? null : MULTI_SHOT_DISABLED_TOOLTIP,
    };
  });
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
 * Model table rows for the selected intent. The visible status stays compact;
 * full unavailable reasons are exposed as metadata so they do not stretch the row.
 */
export function buildModelRows(
  models: ShotVideoTakeModelListReport,
  selectedIntent: ShotVideoTakeIntentId
): ModelRow[] {
  return models.models.map((model) => {
    const supportsIntent = model.supportedIntents.includes(selectedIntent);
    const available = model.available && supportsIntent;
    const unavailableReason =
      model.unavailableReason && !supportsIntent
        ? (INTENT_UNAVAILABLE_REASON[selectedIntent] ?? 'Unavailable')
        : !supportsIntent
          ? (INTENT_UNAVAILABLE_REASON[selectedIntent] ?? 'Unavailable')
          : (model.unavailableReason ?? 'Unavailable');
    return {
      modelChoice: model.modelChoice,
      label: model.label,
      duration: durationLabel(model),
      available,
      status: available ? 'Ready' : 'N/A',
      statusTitle: available ? null : unavailableReason,
    };
  });
}

/** Parameters valid for the current model (and therefore the current intent). */
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

export function defaultModelForIntent(
  models: ShotVideoTakeModelListReport,
  intent: ShotVideoTakeIntentId
): ShotVideoTakeModelChoice | undefined {
  const defaultModel = models.models.find(
    (model) =>
      model.modelChoice === models.defaultModelChoice &&
      model.available &&
      model.supportedIntents.includes(intent)
  );
  if (defaultModel) {
    return defaultModel.modelChoice;
  }
  const match = models.models.find(
    (model) => model.available && model.supportedIntents.includes(intent)
  );
  return match?.modelChoice;
}
