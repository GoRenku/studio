import { describe, expect, it } from 'vitest';
import type { ShotVideoTakeModelListReport } from '@gorenku/studio-core/client';
import {
  buildIntentOptions,
  buildModelRows,
} from './shot-video-take-production-projection';

const MODELS: ShotVideoTakeModelListReport = {
  purpose: 'shot.video-take',
  target: {
    kind: 'sceneShotGroup',
    id: 'g1',
    sceneId: 'scene_hook',
    shotListId: 'list_1',
    productionGroupId: 'g1',
    shotIds: ['s1'],
  },
  defaultModelChoice: 'fal-ai/veo3.1',
  models: [
    {
      modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
      label: 'XAI Grok Imagine Video 1.5',
      available: true,
      supportedIntents: ['first-frame'],
      duration: { supported: true, values: [6], default: 6 },
      inputRoles: [],
      parameters: [],
      estimateInputs: {
        canEstimateBeforeDependenciesExist: true,
        requiresPreparedInputs: false,
      },
    },
    {
      modelChoice: 'fal-ai/veo3.1',
      label: 'Veo 3.1',
      available: true,
      supportedIntents: ['first-last-frame'],
      duration: { supported: true, values: [4, 6, 8], default: 6 },
      inputRoles: [],
      parameters: [],
      estimateInputs: {
        canEstimateBeforeDependenciesExist: false,
        requiresPreparedInputs: true,
      },
    },
  ],
};

describe('buildIntentOptions', () => {
  it('disables multi-shot for single-shot groups with a tooltip', () => {
    const options = buildIntentOptions(1);
    const multi = options.find((option) => option.id === 'multi-shot');
    expect(multi?.enabled).toBe(false);
    expect(multi?.disabledTooltip).toBe(
      'Select adjacent shots in the rail to use multi-shot generation.'
    );
    expect(options.find((option) => option.id === 'text-only')?.enabled).toBe(
      true
    );
  });

  it('enables only multi-shot for multi-shot groups', () => {
    const options = buildIntentOptions(2);
    expect(options.find((option) => option.id === 'multi-shot')?.enabled).toBe(
      true
    );
    const textOnly = options.find((option) => option.id === 'text-only');
    expect(textOnly?.enabled).toBe(false);
    expect(textOnly?.disabledTooltip).toBe(
      'Multi-shot group selected. Split the group to use this intent.'
    );
  });
});

describe('buildModelRows', () => {
  it('reports availability and a concise status per intent', () => {
    const rows = buildModelRows(MODELS, 'first-last-frame');
    const grok = rows.find((row) => row.label === 'XAI Grok Imagine Video 1.5');
    const veo = rows.find((row) => row.label === 'Veo 3.1');
    expect(grok?.available).toBe(false);
    expect(grok?.status).toBe('N/A');
    expect(grok?.statusTitle).toBe('No first/last frame');
    expect(veo?.available).toBe(true);
    expect(veo?.status).toBe('Ready');
    expect(veo?.duration).toBe('4, 6, 8s');
  });
});
