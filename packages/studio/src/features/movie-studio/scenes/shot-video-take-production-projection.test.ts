import { describe, expect, it } from 'vitest';
import type { ShotVideoTakeModelListReport } from '@gorenku/studio-core/client';
import {
  buildInputModeOptions,
  buildModelRows,
} from './shot-video-take-production-projection';

const MODELS: ShotVideoTakeModelListReport = {
  purpose: 'shot.video-take',
  target: {
    kind: 'sceneShotVideoTake',
    id: 'scene_hook:take_001',
    sceneId: 'scene_hook',
    takeId: 'take_001',
    shotIds: ['s1'],
  },
  shotGroupMode: 'single-shot',
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
      'source-video-reference',
    ]);
    expect(options.every((option) => option.enabled)).toBe(true);
    expect(options.every((option) => option.disabledTooltip === null)).toBe(true);
  });

  it('disables input modes unsupported by the selected model', () => {
    const options = buildInputModeOptions(MODELS, 'fal-ai/veo3.1');
    expect(
      options.map(({ id, enabled, disabledTooltip }) => ({
        id,
        enabled,
        disabledTooltip,
      }))
    ).toEqual([
      {
        id: 'text-only',
        enabled: false,
        disabledTooltip: 'No text-only support',
      },
      {
        id: 'first-frame',
        enabled: false,
        disabledTooltip: 'No first frame',
      },
      {
        id: 'first-last-frame',
        enabled: true,
        disabledTooltip: null,
      },
      {
        id: 'reference',
        enabled: false,
        disabledTooltip: 'No reference input',
      },
      {
        id: 'source-video-reference',
        enabled: false,
        disabledTooltip: 'No source video',
      },
    ]);
  });

  it('keeps O3 source-video controls available only for O3 video-to-video models', () => {
    const models: ShotVideoTakeModelListReport = {
      ...MODELS,
      defaultModelChoice: 'fal-ai/kling-video/o3/standard',
      models: [
        ...MODELS.models,
        {
          modelChoice: 'fal-ai/kling-video/o3/standard',
          label: 'Kling O3 Standard',
          available: true,
          supportedInputModes: [
            'text-only',
            'first-frame',
            'reference',
            'source-video-reference',
          ],
          duration: { supported: true, values: [5, 10], default: 5 },
          inputRoles: [],
          parameters: [],
          estimateInputs: {
            canEstimateBeforeDependenciesExist: false,
            requiresPreparedInputs: true,
          },
        },
      ],
    };
    const options = buildInputModeOptions(models, 'fal-ai/kling-video/o3/standard');
    expect(options.find((option) => option.id === 'source-video-reference')).toMatchObject({
      enabled: true,
      disabledTooltip: null,
    });
    expect(options.find((option) => option.id === 'first-last-frame')).toMatchObject({
      enabled: false,
      disabledTooltip: 'No first/last frame',
    });
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
