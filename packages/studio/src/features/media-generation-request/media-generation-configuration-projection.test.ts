import { describe, expect, it } from 'vitest';
import {
  type MediaGenerationConfigurationNode,
  humanizeConfigurationKey,
  projectMediaGenerationConfiguration,
} from './media-generation-configuration-projection';

describe('media generation configuration projection', () => {
  it('preserves exact values, object order, array order, and JSON-derived grouping', () => {
    const configuration = {
      image_size: 'landscape_16_9',
      sync_mode: false,
      steps: [null, 3, { safetyLevel: 'strict' }],
    };

    expect(projectMediaGenerationConfiguration({
      provider: 'unfamiliar-provider',
      model: 'unknown/model-v7',
      configuration,
    })).toEqual([
      { kind: 'value', key: 'provider', label: 'Provider', valueKind: 'string', value: 'unfamiliar-provider' },
      { kind: 'value', key: 'model', label: 'Model', valueKind: 'string', value: 'unknown/model-v7' },
      { kind: 'value', key: 'image_size', label: 'Image Size', valueKind: 'string', value: 'landscape_16_9' },
      { kind: 'value', key: 'sync_mode', label: 'Sync Mode', valueKind: 'boolean', value: false },
      {
        kind: 'group',
        key: 'steps',
        label: 'Steps',
        children: [
          { kind: 'value', key: 'steps.0', label: '1', valueKind: 'null', value: null },
          { kind: 'value', key: 'steps.1', label: '2', valueKind: 'number', value: 3 },
          {
            kind: 'group',
            key: 'steps.2',
            label: '3',
            children: [
              { kind: 'value', key: 'steps.2.safetyLevel', label: 'Safety Level', valueKind: 'string', value: 'strict' },
            ],
          },
        ],
      },
    ]);
    expect(configuration).toEqual({
      image_size: 'landscape_16_9',
      sync_mode: false,
      steps: [null, 3, { safetyLevel: 'strict' }],
    });
  });

  it('humanizes syntax without a provider or field-name presentation map', () => {
    expect(humanizeConfigurationKey('num_images')).toBe('Number Images');
    expect(humanizeConfigurationKey('callbackURL')).toBe('Callback URL');
    expect(humanizeConfigurationKey('asset-id')).toBe('Asset ID');
  });

  it('uses quiet empty nodes and a bounded formatted JSON fallback', () => {
    const nested = { level1: { level2: { level3: { level4: { level5: { level6: { exact: true } } } } } } };
    const nodes = projectMediaGenerationConfiguration({
      provider: 'provider',
      model: 'model',
      configuration: { emptyArray: [], emptyObject: {}, nested },
    });

    expect(nodes[2]).toEqual({ kind: 'empty', key: 'emptyArray', label: 'Empty Array' });
    expect(nodes[3]).toEqual({ kind: 'empty', key: 'emptyObject', label: 'Empty Object' });
    expect(findJsonValue(nodes)).toBe('{\n  "exact": true\n}');
  });
});

function findJsonValue(nodes: MediaGenerationConfigurationNode[]): string | undefined {
  for (const node of nodes) {
    if (node.kind === 'json') return node.value;
    if (node.kind === 'group') {
      const value = findJsonValue(node.children);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}
