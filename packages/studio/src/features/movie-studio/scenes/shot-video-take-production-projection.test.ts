import { describe, expect, it } from 'vitest';
import type { ShotVideoTakeModelReport } from '@gorenku/studio-core/client';
import {
  buildInputModeOptions,
  buildModelRows,
  modelForInputMode,
} from './shot-video-take-production-projection';

const MODELS: ShotVideoTakeModelReport[] = [
    {
      modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
      label: 'XAI Grok Imagine Video 1.5',
      provider: 'fal-ai',
      model: 'xai/grok-imagine-video-1.5',
      supportedInputModes: ['first-frame'],
      duration: { supported: true, values: [6], default: 6 },
      parameters: [],
    },
    {
      modelChoice: 'fal-ai/veo3.1',
      label: 'Veo 3.1',
      provider: 'fal-ai',
      model: 'veo3.1',
      supportedInputModes: ['first-last-frame'],
      duration: { supported: true, values: [4, 6, 8], default: 6 },
      parameters: [],
    },
];

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
    const models: ShotVideoTakeModelReport[] = [
        ...MODELS,
        {
          modelChoice: 'fal-ai/kling-video/o3/standard',
          label: 'Kling O3 Standard',
          provider: 'fal-ai',
          model: 'kling-video/o3/standard',
          supportedInputModes: [
            'text-only',
            'first-frame',
            'reference',
            'source-video-reference',
          ],
          duration: { supported: true, values: [5, 10], default: 5 },
          parameters: [],
        },
      ];
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

  it('preserves family-level input modes while retaining exact provider routes', () => {
    const models: ShotVideoTakeModelReport[] = [
      {
        ...MODELS[0],
        modelChoice: 'fal-ai/seedance/text-to-video',
        model: 'seedance/text-to-video',
        label: 'Seedance 2.0',
        supportedInputModes: ['text-only'],
      },
      {
        ...MODELS[0],
        modelChoice: 'fal-ai/seedance/image-to-video',
        model: 'seedance/image-to-video',
        label: 'Seedance 2.0',
        supportedInputModes: ['first-frame', 'first-last-frame', 'reference'],
      },
    ];

    expect(
      buildInputModeOptions(models, 'fal-ai/seedance/text-to-video')
        .filter((option) => option.enabled)
        .map((option) => option.id)
    ).toEqual(['text-only', 'first-frame', 'first-last-frame', 'reference']);
    expect(
      modelForInputMode(
        models,
        'fal-ai/seedance/text-to-video',
        'first-frame'
      )
    ).toBe('fal-ai/seedance/image-to-video');
  });
});

describe('buildModelRows', () => {
  it('reports Model and Duration data without a Status projection', () => {
    const rows = buildModelRows(MODELS, 'first-last-frame');
    const grok = rows.find((row) => row.label === 'XAI Grok Imagine Video 1.5');
    const veo = rows.find((row) => row.label === 'Veo 3.1');
    expect(grok?.available).toBe(false);
    expect(veo?.available).toBe(true);
    expect(veo?.duration).toBe('4, 6, 8s');
    expect(Object.keys(veo ?? {}).sort()).toEqual([
      'available',
      'duration',
      'label',
      'modelChoice',
    ]);
  });

  it('keeps one visible row per model family while selecting an exact route', () => {
    const rows = buildModelRows([
      {
        ...MODELS[0],
        modelChoice: 'fal-ai/seedance/text-to-video',
        model: 'seedance/text-to-video',
        label: 'Seedance 2.0',
        supportedInputModes: ['text-only'],
      },
      {
        ...MODELS[0],
        modelChoice: 'fal-ai/seedance/image-to-video',
        model: 'seedance/image-to-video',
        label: 'Seedance 2.0',
        supportedInputModes: ['first-frame'],
      },
    ], 'first-frame');

    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Seedance 2.0',
        modelChoice: 'fal-ai/seedance/image-to-video',
        available: true,
      }),
    ]);
  });
});
