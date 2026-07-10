import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@gorenku/studio-engines', () => ({
  runGeneration: vi.fn(),
}));

vi.mock('../../database/access/media-generation.js', () => ({
  insertMediaGenerationRun: vi.fn(),
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
import {
  insertMediaGenerationRun,
} from '../../database/access/media-generation.js';
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
          mediaKind: 'image',
          mode: 'text-to-image',
          outputCount: 1,
        },
        request: {
          prompt: 'Reference image',
          parameters: {},
          outputNames: ['reference-image.png'],
        },
      },
      providerPayload: { prompt: 'Reference image' },
    } as never);

    const report = await runMediaGenerationSpec({
      specId: 'spec-a',
      simulate: false,
      approveLiveProviderRun: true,
      idGenerator: {
        next: (prefix: string) => `${prefix}_test`,
      },
    } as never);

    expect(mockedRunGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: expect.objectContaining({
          provider: 'fal-ai',
          model: 'nano-banana-2',
        }),
        outputRoot: '/project/visual-language/lookbook',
        outputProjectRelativeRoot: 'visual-language/lookbook',
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
        simulated: false,
        status: 'completed',
      })
    );
    expect(report.run).toMatchObject({
      id: 'media_generation_run_test',
      status: 'completed',
    });
  });

  it('rejects shared prepared generations without an output count', async () => {
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
          mediaKind: 'image',
          mode: 'text-to-image',
        },
        request: {
          prompt: 'Reference image',
          parameters: {},
          outputNames: ['reference-image.png'],
        },
      },
      providerPayload: { prompt: 'Reference image' },
    } as never);

    await expect(
      runMediaGenerationSpec({
        specId: 'spec-a',
        simulate: true,
      } as never)
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_GENERATION_OUTPUT_COUNT_INVALID',
    });

    expect(mockedRunGeneration).not.toHaveBeenCalled();
    expect(mockedInsertRun).not.toHaveBeenCalled();
  });

  it('fails live shared runs without explicit provider approval before execution', async () => {
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
          mediaKind: 'image',
          mode: 'text-to-image',
          outputCount: 1,
        },
        request: {
          prompt: 'Reference image',
          parameters: {},
          outputNames: ['reference-image.png'],
        },
      },
      providerPayload: { prompt: 'Reference image' },
    } as never);

    await expect(
      runMediaGenerationSpec({
        specId: 'spec-a',
      } as never)
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_LIVE_PROVIDER_APPROVAL_REQUIRED',
    });

    expect(mockedRunGeneration).not.toHaveBeenCalled();
    expect(mockedInsertRun).not.toHaveBeenCalled();
  });
});
