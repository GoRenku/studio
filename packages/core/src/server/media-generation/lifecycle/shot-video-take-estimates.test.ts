import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

vi.mock('../purposes/shot-video-take/specs/final-spec-construction.js', () => ({
  buildShotVideoTakeFinalSpec: vi.fn(),
}));

vi.mock('../cost/cost-projection.js', async () => {
  const actual = await vi.importActual<typeof import('../cost/cost-projection.js')>(
    '../cost/cost-projection.js'
  );
  return {
    ...actual,
    buildMediaGenerationCostProjection: vi.fn(),
  };
});

import { buildMediaGenerationCostProjection } from '../cost/cost-projection.js';
import { buildShotVideoTakeFinalSpec } from '../purposes/shot-video-take/specs/final-spec-construction.js';
import { estimateShotVideoTakeFinalPlanLine } from './shot-video-take-estimates.js';

const mockedBuildFinalSpec = vi.mocked(buildShotVideoTakeFinalSpec);
const mockedBuildCostProjection = vi.mocked(buildMediaGenerationCostProjection);

describe('Shot Video Take lifecycle final estimate line', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBuildFinalSpec.mockReturnValue({
      purpose: 'shot.video-take',
      parameterValues: {},
    } as never);
  });

  it('returns priced final plan estimates without diagnostics', async () => {
    mockedBuildCostProjection.mockResolvedValueOnce({
      estimate: {
        state: 'priced',
        estimatedCostUsd: 2.5,
      },
    } as never);
    const diagnostics: DiagnosticIssue[] = [];

    await expect(
      estimateShotVideoTakeFinalPlanLine({
        context: { sceneId: 'scene-a' } as never,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/veo3.1',
        normalizedSettings: {},
        preparedInputs: [],
        diagnostics,
      })
    ).resolves.toEqual({
      pricing: { state: 'priced', estimatedUsd: 2.5 },
      diagnostics: [],
      estimate: { state: 'priced', estimatedCostUsd: 2.5 },
    });
    expect(diagnostics).toEqual([]);
    expect(mockedBuildFinalSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMode: 'estimate-placeholder',
      })
    );
  });

  it('records diagnostics for missing pricing inputs and unpriced estimates', async () => {
    const missingDiagnostics: DiagnosticIssue[] = [];
    mockedBuildCostProjection.mockResolvedValueOnce({
      estimate: {
        state: 'missing-pricing-input',
        estimatedCostUsd: null,
        missingInputs: ['durationSeconds'],
      },
    } as never);

    await expect(
      estimateShotVideoTakeFinalPlanLine({
        context: {} as never,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/veo3.1',
        normalizedSettings: {},
        preparedInputs: [],
        diagnostics: missingDiagnostics,
      })
    ).resolves.toMatchObject({
      pricing: {
        state: 'missing-pricing-input',
        missingInputs: ['durationSeconds'],
      },
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_PLAN_COST_INPUT_MISSING',
        }),
      ],
    });
    expect(missingDiagnostics).toHaveLength(1);

    const unpricedDiagnostics: DiagnosticIssue[] = [];
    mockedBuildCostProjection.mockResolvedValueOnce({
      estimate: {
        state: 'unpriced',
        estimatedCostUsd: null,
        reason: 'No price configured.',
      },
    } as never);

    await expect(
      estimateShotVideoTakeFinalPlanLine({
        context: {} as never,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/veo3.1',
        normalizedSettings: {},
        preparedInputs: [],
        diagnostics: unpricedDiagnostics,
      })
    ).resolves.toMatchObject({
      pricing: {
        state: 'unpriced',
        reason: 'No price configured.',
      },
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
        }),
      ],
    });
    expect(unpricedDiagnostics).toHaveLength(1);
  });
});
