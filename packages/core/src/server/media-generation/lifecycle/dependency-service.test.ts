import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../dependencies/dependency-inventory.js', () => ({
  planMediaGenerationDependencyInventory: vi.fn(),
}));

vi.mock('../dependencies/dependency-inventory-lines.js', () => ({
  planLinesFromDependencyInventory: vi.fn(),
}));

vi.mock('../dependencies/dependency-selectors.js', () => ({
  resolveMediaGenerationDependencySelection: vi.fn(),
}));

vi.mock('../cost/spec-estimates.js', () => ({
  estimateDraftMediaGenerationSpec: vi.fn(),
}));

vi.mock('../cost/cost-projection.js', () => ({
  mediaGenerationCostEstimateToPricing: vi.fn(),
}));

vi.mock('./project-session.js', () => ({
  withMediaGenerationProjectSession: vi.fn(),
}));

vi.mock('./purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

import {
  planMediaGenerationDependencyInventory,
} from '../dependencies/dependency-inventory.js';
import {
  planLinesFromDependencyInventory,
} from '../dependencies/dependency-inventory-lines.js';
import {
  resolveMediaGenerationDependencySelection,
} from '../dependencies/dependency-selectors.js';
import { mediaGenerationCostEstimateToPricing } from '../cost/cost-projection.js';
import { estimateDraftMediaGenerationSpec } from '../cost/spec-estimates.js';
import { withMediaGenerationProjectSession } from './project-session.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  assertRootDependenciesResolved,
  planMediaGenerationDependencies,
} from './dependency-service.js';

const mockedPlanInventory = vi.mocked(planMediaGenerationDependencyInventory);
const mockedPlanLines = vi.mocked(planLinesFromDependencyInventory);
const mockedResolveSelection = vi.mocked(resolveMediaGenerationDependencySelection);
const mockedEstimateDraft = vi.mocked(estimateDraftMediaGenerationSpec);
const mockedCostToPricing = vi.mocked(mediaGenerationCostEstimateToPricing);
const mockedWithProjectSession = vi.mocked(withMediaGenerationProjectSession);
const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);

describe('media generation lifecycle dependency service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithProjectSession.mockImplementation(async (_input, fn) =>
      fn({ session: { kind: 'session' }, projectFolder: '/project' } as never)
    );
    mockedResolveSelection.mockReturnValue({
      state: 'missing',
      asset: null,
      diagnostics: [],
    });
    mockedEstimateDraft.mockResolvedValue({
      estimate: { state: 'priced', estimatedCostUsd: 2 },
    } as never);
    mockedCostToPricing.mockReturnValue({ state: 'priced', estimatedUsd: 2 });
    mockedPlanLines.mockReturnValue([{ id: 'line:root' }] as never);
  });

  it('validates specs, declares dependencies, and maps inventory to plan lines', async () => {
    const slot = {
      dependencyId: 'manual:test',
      dependencyKind: 'manual-attachment',
      label: 'Manual plate',
      dependencyTarget: { kind: 'scene', id: 'scene-a' },
      selector: {
        kind: 'manual-attachment',
        target: { kind: 'scene', id: 'scene-a' },
      },
      required: true,
      reason: 'Manual input.',
    };
    const validateSpec = vi.fn(async () => ({
      spec: {
        purpose: 'shot.video-take',
        target: { kind: 'sceneShotVideoTake', id: 'take-a' },
      },
    }));
    const declareDependencies = vi.fn(async () => [slot]);
    mockedRequireDefinition.mockImplementation((purpose) =>
      ({
        purpose,
        mediaKind: purpose === 'shot.video-take' ? 'video' : 'image',
        validateSpec,
        declareDependencies,
      }) as never
    );
    mockedPlanInventory.mockImplementationOnce(async (input) => {
      await input.resolveSelection(slot as never);
      await input.declareDependencies({
        purpose: 'shot.first-frame',
        lineId: 'dependency:first-frame',
        slot: slot as never,
      });
      const rootEstimate = await input.estimateRoot();
      return {
        dependencyInventory: {
          rootPurpose: 'shot.video-take',
          rootTarget: { kind: 'sceneShotVideoTake', id: 'take-a' },
          dependencies: [],
          rootGeneration: { id: 'root:shot.video-take' },
          estimate: { state: 'complete' },
          diagnostics: [],
          agentChecklist: [],
        },
        rootEstimate: rootEstimate.estimate,
      } as never;
    });

    await expect(
      planMediaGenerationDependencies({
        homeDir: '/home',
        spec: { purpose: 'shot.video-take' },
      } as never)
    ).resolves.toMatchObject({
      rootPurpose: 'shot.video-take',
      lines: [{ id: 'line:root' }],
      finalEstimate: { state: 'priced', estimatedCostUsd: 2 },
      diagnostics: [],
    });

    expect(validateSpec).toHaveBeenCalled();
    expect(declareDependencies).toHaveBeenCalledWith(
      expect.objectContaining({
        rootPurpose: 'shot.video-take',
        purpose: 'shot.video-take',
      })
    );
    expect(mockedResolveSelection).toHaveBeenCalledWith({
      request: {
        kind: 'media-generation-spec',
        spec: {
          purpose: 'shot.video-take',
          target: { kind: 'sceneShotVideoTake', id: 'take-a' },
        },
      },
      session: { kind: 'session' },
      slot,
    });
  });

  it('throws structured diagnostics when required root dependencies remain unresolved', async () => {
    mockedRequireDefinition.mockReturnValue({
      mediaKind: 'video',
      validateSpec: vi.fn(async () => ({
        spec: {
          purpose: 'shot.video-take',
          target: { kind: 'sceneShotVideoTake', id: 'take-a' },
        },
      })),
      declareDependencies: vi.fn(async () => []),
    } as never);
    mockedPlanInventory.mockResolvedValueOnce({
      dependencyInventory: {
        rootPurpose: 'shot.video-take',
        rootTarget: { kind: 'sceneShotVideoTake', id: 'take-a' },
        dependencies: [
          {
            id: 'dependency:manual',
            label: 'Manual plate',
            required: true,
            availability: { state: 'missing-manual' },
            diagnostics: [
              createDiagnosticError(
                'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
                'Manual plate is missing.',
                { path: ['dependencyInventory'] },
                'Attach the plate.'
              ),
            ],
          },
        ],
        rootGeneration: { id: 'root:shot.video-take' },
        estimate: { state: 'unavailable' },
        diagnostics: [],
        agentChecklist: [],
      },
      rootEstimate: null,
    } as never);

    await expect(
      assertRootDependenciesResolved({
        homeDir: '/home',
        spec: { purpose: 'shot.video-take' },
      } as never)
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCIES',
      issues: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
        }),
      ],
    });
  });
});
