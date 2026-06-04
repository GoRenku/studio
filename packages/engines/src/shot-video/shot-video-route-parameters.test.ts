import { describe, expect, it } from 'vitest';
import type { ShotVideoRoute } from './shot-video-model-families.js';
import { normalizeShotVideoRouteSettings } from './shot-video-route-parameters.js';

const route = {
  inputMode: 'text-only',
  shotGroupMode: 'single-shot',
  providerModel: 'fake-provider/text-to-video',
  mode: 'text-to-video',
  inputSlots: [],
  parameters: [
    {
      id: 'duration',
      providerField: 'duration_seconds',
      label: 'Duration',
      control: 'duration',
      required: true,
      defaultValue: 'auto',
      allowedValues: ['auto', '4', '8s'],
    },
  ],
  duration: null,
  pricing: { provider: 'fal-ai', providerModel: 'fake-provider' },
} satisfies ShotVideoRoute;

describe('normalizeShotVideoRouteSettings', () => {
  it('normalizes parseable duration values against allowed duration forms', () => {
    const result = normalizeShotVideoRouteSettings({
      route,
      settings: { duration: 8 },
    });

    expect(result.values.duration).toBe('8s');
    expect(result.providerValues.duration_seconds).toBe('8s');
    expect(result.invalidSettingIds).toEqual([]);
  });

  it('rejects duration values that do not parse as seconds', () => {
    const result = normalizeShotVideoRouteSettings({
      route,
      settings: { duration: 'banana' },
    });

    expect(result.values).toEqual({});
    expect(result.providerValues).toEqual({});
    expect(result.invalidSettingIds).toEqual(['duration']);
  });
});
