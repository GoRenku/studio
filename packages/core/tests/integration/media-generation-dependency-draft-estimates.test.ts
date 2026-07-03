import { describe, expect, it, vi } from 'vitest';
import type { MediaGenerationEstimateReport } from '../../src/client/index.js';

vi.mock('../../src/server/media-generation/estimation/spec-estimates.js', () => ({
  estimateDraftMediaGenerationSpec: vi.fn(),
}));

import { estimateDraftMediaGenerationSpec } from '../../src/server/media-generation/estimation/spec-estimates.js';
import { estimateMediaGenerationDependencyDraft } from '../../src/server/media-generation/estimation/dependency-draft-estimates.js';

const mockedEstimateDraftMediaGenerationSpec = vi.mocked(
  estimateDraftMediaGenerationSpec
);

describe('media generation dependency draft estimate classification', () => {
  it('classifies supported provider routes without pricing as unpriced dependency lines', async () => {
    mockedEstimateDraftMediaGenerationSpec.mockResolvedValueOnce({
      estimate: {
        state: 'unpriced',
        provider: 'fal-ai',
        model: 'image-model',
        mediaKind: 'image',
        pricing: null,
        estimatedCostUsd: null,
        reason: 'No pricing is configured for this model.',
        costApprovalToken: null,
        warnings: ['No pricing is configured for this model.'],
        billableUnits: {},
      },
    } as MediaGenerationEstimateReport);

    await expect(
      estimateMediaGenerationDependencyDraft({
        draftGenerationSpec: {
          purpose: 'lookbook.sheet',
          spec: {} as never,
        },
        dependencyId: 'lookbook-sheet:lookbook-a',
        label: 'Lookbook sheet',
      })
    ).resolves.toEqual({
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: 'No pricing is configured for this model.',
        overrideRequired: true,
      },
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_UNPRICED_LINE',
          severity: 'error',
        }),
      ],
    });
  });

  it('propagates invalid draft estimate failures', async () => {
    mockedEstimateDraftMediaGenerationSpec.mockRejectedValueOnce(
      new Error('Draft estimate exploded.')
    );

    await expect(
      estimateMediaGenerationDependencyDraft({
        draftGenerationSpec: {
          purpose: 'lookbook.sheet',
          spec: {} as never,
        },
        dependencyId: 'lookbook-sheet:lookbook-a',
        label: 'Lookbook sheet',
      })
    ).rejects.toThrow('Draft estimate exploded.');
  });
});
