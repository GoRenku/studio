import { describe, expect, it, vi } from 'vitest';
import type { MediaGenerationEstimateReport } from '../../src/client/index.js';

vi.mock('../../src/server/media-generation/shared-generation-service.js', () => ({
  estimateDraftMediaGenerationSpec: vi.fn(),
}));

import { estimateDraftMediaGenerationSpec } from '../../src/server/media-generation/shared-generation-service.js';
import { estimateMediaGenerationDependencyDraft } from '../../src/server/media-generation/dependency-draft-estimates.js';

const mockedEstimateDraftMediaGenerationSpec = vi.mocked(
  estimateDraftMediaGenerationSpec
);

describe('media generation dependency draft estimate classification', () => {
  it('classifies supported provider routes without pricing as unpriced dependency lines', async () => {
    mockedEstimateDraftMediaGenerationSpec.mockResolvedValueOnce({
      estimate: {
        provider: 'fal-ai',
        model: 'image-model',
        estimatedCostUsd: null,
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

  it('classifies invalid draft estimate failures as structured diagnostics', async () => {
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
    ).resolves.toEqual({
      pricing: {
        state: 'unpriced',
        estimatedUsd: null,
        reason: 'Draft estimate exploded.',
        overrideRequired: true,
      },
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_ESTIMATE_FAILED',
          severity: 'error',
        }),
      ],
    });
  });
});
