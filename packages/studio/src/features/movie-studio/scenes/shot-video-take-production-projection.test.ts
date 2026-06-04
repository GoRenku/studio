import { describe, expect, it } from 'vitest';
import type { ShotVideoTakeModelListReport } from '@gorenku/studio-core/client';
import {
  buildInputModeOptions,
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
      supportedInputModes: ['first-frame'],
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
      supportedInputModes: ['first-last-frame'],
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

describe('buildInputModeOptions', () => {
  it('returns only real input modes and leaves group mode out of the selector', () => {
    const options = buildInputModeOptions();
    expect(options.map((option) => option.id)).toEqual([
      'text-only',
      'first-frame',
      'first-last-frame',
      'reference',
    ]);
    expect(options.every((option) => option.enabled)).toBe(true);
    expect(options.every((option) => option.disabledTooltip === null)).toBe(true);
  });
});

describe('buildModelRows', () => {
  it('reports availability and a concise status per input mode', () => {
    const rows = buildModelRows(MODELS, 'first-last-frame');
    const grok = rows.find((row) => row.label === 'XAI Grok Imagine Video 1.5');
    const veo = rows.find((row) => row.label === 'Veo 3.1');
    expect(grok?.available).toBe(false);
    expect(grok?.status).toBe('Unavailable');
    expect(grok?.statusTitle).toBe('No first/last frame');
    expect(veo?.available).toBe(true);
    expect(veo?.status).toBe('Input required');
    expect(veo?.statusTitle).toBe(
      'The selected input mode needs a prepared input, such as a first frame or reference image.'
    );
    expect(veo?.duration).toBe('4, 6, 8s');
  });
});
