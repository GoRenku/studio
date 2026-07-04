import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@gorenku/studio-engines', () => ({
  runGeneration: vi.fn(),
}));

vi.mock('../../database/access/media-generation.js', () => ({
  insertMediaGenerationRun: vi.fn(),
}));

vi.mock('../cost/cost-approval.js', () => ({
  mediaGenerationEstimateWithApproval: vi.fn(),
  mediaGenerationRunApprovalToken: vi.fn(),
  parseMediaGenerationRunCostApproval: vi.fn(),
  requireMediaGenerationCostApproval: vi.fn(),
}));

vi.mock('../cost/cost-projection.js', () => ({
  estimateMediaGenerationSpecRecordCost: vi.fn(),
}));

vi.mock('./project-session.js', () => ({
  withMediaGenerationProjectSession: vi.fn(),
}));

vi.mock('./purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

vi.mock('./spec-service.js', () => ({
  prepareMediaGenerationSpec: vi.fn(),
  readMediaGenerationSpec: vi.fn(),
}));

import { runGeneration } from '@gorenku/studio-engines';
import { insertMediaGenerationRun } from '../../database/access/media-generation.js';
import {
  mediaGenerationEstimateWithApproval,
  mediaGenerationRunApprovalToken,
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from '../cost/cost-approval.js';
import { estimateMediaGenerationSpecRecordCost } from '../cost/cost-projection.js';
import { withMediaGenerationProjectSession } from './project-session.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  prepareMediaGenerationSpec,
  readMediaGenerationSpec,
} from './spec-service.js';
import { runMediaGenerationSpec } from './run-service.js';

const mockedRunGeneration = vi.mocked(runGeneration);
const mockedInsertRun = vi.mocked(insertMediaGenerationRun);
const mockedEstimateWithApproval = vi.mocked(mediaGenerationEstimateWithApproval);
const mockedApprovalToken = vi.mocked(mediaGenerationRunApprovalToken);
const mockedParseApproval = vi.mocked(parseMediaGenerationRunCostApproval);
const mockedRequireApproval = vi.mocked(requireMediaGenerationCostApproval);
const mockedEstimateCost = vi.mocked(estimateMediaGenerationSpecRecordCost);
const mockedWithProjectSession = vi.mocked(withMediaGenerationProjectSession);
const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);
const mockedPrepareSpec = vi.mocked(prepareMediaGenerationSpec);
const mockedReadSpec = vi.mocked(readMediaGenerationSpec);

describe('media generation lifecycle run service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithProjectSession.mockImplementation(async (_input, fn) =>
      fn({ session: { kind: 'session' }, projectFolder: '/project' } as never)
    );
    mockedRunGeneration.mockResolvedValue({
      outputs: [{ projectRelativePath: 'generated/media/output.png' }],
      diagnostics: { warnings: [] },
    } as never);
    mockedInsertRun.mockImplementation((_session, run) => run as never);
    mockedEstimateCost.mockResolvedValue({
      state: 'priced',
      estimatedCostUsd: 1.5,
    } as never);
    mockedParseApproval.mockReturnValue({ kind: 'priced', approvalToken: 'token' });
    mockedRequireApproval.mockReturnValue({
      kind: 'priced',
      approvalToken: 'token',
    });
    mockedEstimateWithApproval.mockReturnValue({ approved: true } as never);
    mockedApprovalToken.mockReturnValue('approval-token');
  });

  it('delegates Shot Video Take runs to the owning purpose implementation', async () => {
    const runSpec = vi.fn(async () => ({ run: { id: 'take-run' } }));
    mockedReadSpec.mockResolvedValueOnce({
      id: 'spec-a',
      purpose: 'shot.video-take',
      spec: { purpose: 'shot.video-take' },
    } as never);
    mockedRequireDefinition.mockReturnValueOnce({ runSpec } as never);

    await expect(
      runMediaGenerationSpec({ specId: 'spec-a', simulate: true } as never)
    ).resolves.toEqual({ run: { id: 'take-run' } });

    expect(runSpec).toHaveBeenCalledWith({ specId: 'spec-a', simulate: true });
    expect(mockedRunGeneration).not.toHaveBeenCalled();
    expect(mockedInsertRun).not.toHaveBeenCalled();
  });

  it('runs non-shot specs through shared approval, execution, and run persistence', async () => {
    mockedReadSpec.mockResolvedValueOnce({
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: { purpose: 'lookbook.image' },
    } as never);
    mockedPrepareSpec.mockResolvedValueOnce({
      spec: {
        id: 'spec-a',
        purpose: 'lookbook.image',
        spec: { purpose: 'lookbook.image' },
      },
      generation: {
        policy: {
          provider: 'fal-ai',
          model: 'nano-banana-2',
        },
        request: { prompt: 'Reference image' },
      },
      providerPayload: { prompt: 'Reference image' },
    } as never);

    const report = await runMediaGenerationSpec({
      specId: 'spec-a',
      simulate: true,
      approvalToken: 'token',
      idGenerator: {
        next: () => 'media_generation_run_test',
      },
    } as never);

    expect(mockedRequireApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'simulated',
        purpose: 'lookbook.image',
      })
    );
    expect(mockedRunGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: {
          provider: 'fal-ai',
          model: 'nano-banana-2',
        },
        outputRoot: '/project/generated/media',
        outputProjectRelativeRoot: 'generated/media',
        inputRoot: '/project',
      })
    );
    expect(mockedInsertRun).toHaveBeenCalledWith(
      { kind: 'session' },
      expect.objectContaining({
        id: 'media_generation_run_test',
        specId: 'spec-a',
        provider: 'fal-ai',
        model: 'nano-banana-2',
        approvalToken: 'approval-token',
        simulated: true,
        status: 'simulated',
      })
    );
    expect(report.run).toMatchObject({
      id: 'media_generation_run_test',
      status: 'simulated',
    });
  });
});
