import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../purposes/shot-video-take/planning/production-plan.js', () => ({
  planShotVideoTakeProduction: vi.fn(),
  shotVideoTakePlanReportContext: vi.fn(),
}));

import {
  planShotVideoTakeProduction,
  shotVideoTakePlanReportContext,
} from '../purposes/shot-video-take/planning/production-plan.js';
import { estimateShotVideoTakeProduction } from './shot-video-take-production-estimates.js';

const mockedPlanProduction = vi.mocked(planShotVideoTakeProduction);
const mockedReportContext = vi.mocked(shotVideoTakePlanReportContext);

describe('Shot Video Take production estimate lifecycle service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines production plan and report context into the public estimate report', async () => {
    mockedPlanProduction.mockResolvedValueOnce({
      request: {
        inputMode: 'first-frame',
        shotGroupMode: 'continuous',
        modelChoice: 'fal-ai/veo3.1',
      },
      finalEstimate: { state: 'priced', estimatedCostUsd: 2 },
      diagnostics: [{ code: 'CORE_TEST', severity: 'warning' }],
    } as never);
    mockedReportContext.mockResolvedValueOnce({
      target: { kind: 'sceneShotVideoTake', id: 'scene-a:take-a' },
      take: { id: 'take-a' },
    } as never);

    await expect(
      estimateShotVideoTakeProduction({
        homeDir: '/home',
        projectName: 'movie',
        sceneId: 'scene-a',
        takeId: 'take-a',
      } as never)
    ).resolves.toMatchObject({
      target: { kind: 'sceneShotVideoTake', id: 'scene-a:take-a' },
      take: { id: 'take-a' },
      inputModeId: 'first-frame',
      shotGroupMode: 'continuous',
      modelChoice: 'fal-ai/veo3.1',
      estimate: { state: 'priced', estimatedCostUsd: 2 },
      issues: [{ code: 'CORE_TEST', severity: 'warning' }],
    });
  });
});
