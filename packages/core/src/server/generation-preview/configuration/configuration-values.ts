import type {
  GenerationPreviewConfigurationValue,
  GenerationPreviewConfigurationValueSource,
} from '../../../client/index.js';

export function previewConfigurationValue(
  value: unknown
): GenerationPreviewConfigurationValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { width?: unknown }).width === 'number' &&
    typeof (value as { height?: unknown }).height === 'number'
  ) {
    return {
      kind: 'dimensions',
      width: (value as { width: number }).width,
      height: (value as { height: number }).height,
    };
  }
  if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean'
    )
  ) {
    return value;
  }
  return undefined;
}

export function configurationValueLabel(
  value: GenerationPreviewConfigurationValue
): string {
  if (value === null) {
    return 'Not set';
  }
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  if (typeof value === 'object') {
    return `${value.width} x ${value.height}`;
  }
  return String(value);
}

export function sourceLabel(
  source: GenerationPreviewConfigurationValueSource
): string {
  switch (source) {
    case 'spec':
      return 'spec';
    case 'context-default':
      return 'context default';
    case 'renku-fixed':
      return 'Renku fixed';
    case 'provider-default':
      return 'provider default';
    case 'derived':
      return 'derived';
    case 'model-capability':
      return 'model capability';
    case 'provider-route':
      return 'provider route';
  }
}
