import { describe, expect, it } from 'vitest';
import type {
  ShotVideoTakeGenerationSetup,
  ShotVideoTakeModelReport,
} from './shot-video-take-workspace.js';
import { selectShotVideoTakeGenerationModel } from './shot-video-take-workspace.js';

describe('Shot Video Take generation model selection', () => {
  it('materializes the selected model defaults and drops prior-model parameters', () => {
    const setup: ShotVideoTakeGenerationSetup = {
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/old-model',
      parameterValues: { duration: 5, old_setting: true },
    };
    const model = {
      modelChoice: 'fal-ai/new-model',
      parameters: [
        { name: 'duration', label: 'Duration', required: false, defaultValue: 4 },
        { name: 'resolution', label: 'Resolution', required: false, defaultValue: '720p' },
        { name: 'seed', label: 'Seed', required: false },
      ],
    } as ShotVideoTakeModelReport;

    expect(selectShotVideoTakeGenerationModel(setup, model)).toEqual({
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/new-model',
      parameterValues: { duration: 4, resolution: '720p' },
    });
  });

  it('preserves authored parameters when the selected model did not change', () => {
    const setup: ShotVideoTakeGenerationSetup = {
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/current-model',
      parameterValues: { duration: 6 },
    };
    const model = {
      modelChoice: 'fal-ai/current-model',
      parameters: [],
    } as unknown as ShotVideoTakeModelReport;

    expect(selectShotVideoTakeGenerationModel(setup, model)).toBe(setup);
  });
});
