import type { JsonValue } from '@gorenku/studio-core/client';

const maxProjectionDepth = 6;
const maxStructuredValueLength = 4_000;

export type MediaGenerationConfigurationNode =
  | {
      kind: 'value';
      key: string;
      label: string;
      valueKind: 'string' | 'number' | 'boolean' | 'null';
      value: string | number | boolean | null;
    }
  | {
      kind: 'group';
      key: string;
      label: string;
      children: MediaGenerationConfigurationNode[];
    }
  | {
      kind: 'empty';
      key: string;
      label: string;
    }
  | {
      kind: 'json';
      key: string;
      label: string;
      value: string;
    };

export function projectMediaGenerationConfiguration(input: {
  provider: string;
  model: string;
  configuration: JsonValue;
}): MediaGenerationConfigurationNode[] {
  return [
    valueNode('provider', 'Provider', input.provider),
    valueNode('model', 'Model', input.model),
    ...projectRootConfiguration(input.configuration),
  ];
}

export function humanizeConfigurationKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return key;
  return words.map(humanizeWord).join(' ');
}

function projectRootConfiguration(value: JsonValue): MediaGenerationConfigurationNode[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).map(([key, entry]) =>
      projectNode(key, humanizeConfigurationKey(key), entry, 0)
    );
  }
  return [projectNode('configuration', 'Configuration', value, 0)];
}

function projectNode(
  key: string,
  label: string,
  value: JsonValue,
  depth: number
): MediaGenerationConfigurationNode {
  if (value === null || typeof value !== 'object') {
    return valueNode(key, label, value);
  }
  if (shouldUseJsonFallback(value, depth)) {
    return {
      kind: 'json',
      key,
      label,
      value: JSON.stringify(value, null, 2),
    };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'empty', key, label };
    return {
      kind: 'group',
      key,
      label,
      children: value.map((entry, index) =>
        projectNode(`${key}.${index}`, String(index + 1), entry, depth + 1)
      ),
    };
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return { kind: 'empty', key, label };
  return {
    kind: 'group',
    key,
    label,
    children: entries.map(([entryKey, entry]) =>
      projectNode(
        `${key}.${entryKey}`,
        humanizeConfigurationKey(entryKey),
        entry,
        depth + 1
      )
    ),
  };
}

function shouldUseJsonFallback(
  value: JsonValue[] | { [key: string]: JsonValue },
  depth: number
): boolean {
  if (depth >= maxProjectionDepth) return true;
  return JSON.stringify(value).length > maxStructuredValueLength;
}

function valueNode(
  key: string,
  label: string,
  value: string | number | boolean | null
): MediaGenerationConfigurationNode {
  return {
    kind: 'value',
    key,
    label,
    valueKind: configurationValueKind(value),
    value,
  };
}

function configurationValueKind(
  value: string | number | boolean | null
): 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  return 'boolean';
}

function humanizeWord(word: string): string {
  const lower = word.toLowerCase();
  if (lower === 'num') return 'Number';
  if (['api', 'http', 'https', 'id', 'ui', 'url', 'uri'].includes(lower)) {
    return lower.toUpperCase();
  }
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}
