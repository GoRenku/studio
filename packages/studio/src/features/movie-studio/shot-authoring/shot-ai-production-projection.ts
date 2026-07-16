import type {
  ShotGenerationInputModeId,
  ShotGenerationModelReport,
  ShotGenerationParameterReport,
} from '@gorenku/studio-core/client';

/**
 * Pure projection helpers for the AI Production tab (0041). Input-mode
 * availability, model status reasons, and enabled parameters are derived here
 * from core reports so the components stay thin. No hooks, services, or fetch.
 */

export const SHOT_GENERATION_INPUT_MODE_IDS: ShotGenerationInputModeId[] = [
  'text-only',
  'first-frame',
  'first-last-frame',
  'reference',
  'source-video-reference',
];

const INPUT_MODE_LABELS: Partial<Record<ShotGenerationInputModeId, string>> = {
  'text-only': 'Text only',
  'first-frame': 'First frame',
  'first-last-frame': 'First + last frame',
  reference: 'Reference',
  'source-video-reference': 'Source video',
};

const INPUT_MODE_UNAVAILABLE_REASON: Partial<Record<ShotGenerationInputModeId, string>> = {
  'text-only': 'No text-only support',
  'first-frame': 'No first frame',
  'first-last-frame': 'No first/last frame',
  reference: 'No reference input',
  'source-video-reference': 'No source video',
};

export interface InputModeOption {
  id: ShotGenerationInputModeId;
  label: string;
  enabled: boolean;
  disabledTooltip: string | null;
}

export function buildInputModeOptions(
  models?: ShotGenerationModelReport[] | null,
  selectedModel?: string
): InputModeOption[] {
  const model = models ? findModelReport(models, selectedModel) : null;
  const family = model && models
    ? models.filter((candidate) => candidate.label === model.label)
    : model ? [model] : [];
  return SHOT_GENERATION_INPUT_MODE_IDS.map((id) => ({
    id,
    label: INPUT_MODE_LABELS[id] ?? id,
    enabled: !model || family.some((candidate) => candidate.supportedInputModes.includes(id)),
    disabledTooltip:
      model && !family.some((candidate) => candidate.supportedInputModes.includes(id))
        ? (INPUT_MODE_UNAVAILABLE_REASON[id] ?? 'Unavailable')
        : null,
  }));
}

export function modelForInputMode(
  models: ShotGenerationModelReport[],
  selectedModel: string | undefined,
  inputMode: ShotGenerationInputModeId
): string | undefined {
  const selected = findModelReport(models, selectedModel);
  const familyMatch = selected
    ? models
        .filter(
          (model) =>
            model.label === selected.label &&
            model.supportedInputModes.includes(inputMode)
        )
        .sort(
          (left, right) =>
            left.supportedInputModes.length - right.supportedInputModes.length
        )[0]
    : undefined;
  return familyMatch?.modelChoice ?? defaultModelForInputMode(models, inputMode);
}

export function findModelReport(
  models: ShotGenerationModelReport[],
  modelChoice: string | undefined
): ShotGenerationModelReport | null {
  if (!modelChoice) {
    return null;
  }
  return (
    models.find((model) => model.modelChoice === modelChoice) ?? null
  );
}

function durationLabel(model: ShotGenerationModelReport): string {
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
  return 'Unspecified';
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
  modelChoice: string;
  label: string;
  duration: string;
  available: boolean;
}

/**
 * Model table rows for the selected input mode. The visible status stays
 * compact; full unavailable reasons are exposed as metadata so they do not
 * stretch the row.
 */
export function buildModelRows(
  models: ShotGenerationModelReport[],
  selectedInputMode: ShotGenerationInputModeId
): ModelRow[] {
  const families = new Map<string, ShotGenerationModelReport[]>();
  for (const model of models) {
    families.set(model.label, [...(families.get(model.label) ?? []), model]);
  }
  return [...families.entries()].map(([label, family]) => {
    const matchingModel = family
      .filter((model) => model.supportedInputModes.includes(selectedInputMode))
      .sort(
        (left, right) =>
          left.supportedInputModes.length - right.supportedInputModes.length
      )[0];
    const model = matchingModel ?? family[0]!;
    return {
      modelChoice: model.modelChoice,
      label,
      duration: matchingModel ? durationLabel(model) : '—',
      available: Boolean(matchingModel),
    };
  });
}

/** Parameters valid for the current model and selected input mode. */
export function enabledParameters(
  model: ShotGenerationModelReport | null
): ShotGenerationParameterReport[] {
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
  models: ShotGenerationModelReport[],
  inputMode: ShotGenerationInputModeId
): string | undefined {
  const match = models.find(
    (model) => model.supportedInputModes.includes(inputMode)
  );
  return match?.modelChoice;
}
