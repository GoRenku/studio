import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MediaGenerationDependencySlot,
  SceneShotVideoTakeTarget,
} from '../../../client/index.js';

vi.mock('./dependency-draft-specs.js', () => ({
  planMediaGenerationDependencyDraft: vi.fn(),
}));

vi.mock('../cost/dependency-draft-estimates.js', () => ({
  estimateMediaGenerationDependencyDraft: vi.fn(),
}));

import { estimateMediaGenerationDependencyDraft } from '../cost/dependency-draft-estimates.js';
import { planMediaGenerationDependencyDraft } from './dependency-draft-specs.js';
import { planMediaGenerationDependencyInventory } from './dependency-inventory.js';

const mockedPlanDependencyDraft = vi.mocked(planMediaGenerationDependencyDraft);
const mockedEstimateDependencyDraft = vi.mocked(estimateMediaGenerationDependencyDraft);

const takeTarget: SceneShotVideoTakeTarget = {
  kind: 'sceneShotVideoTake',
  id: 'scene-a:take-a',
  sceneId: 'scene-a',
  takeId: 'take-a',
  shotIds: ['shot-a'],
};

describe('media generation dependency inventory planner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlanDependencyDraft.mockResolvedValue({
      purpose: 'shot.first-frame',
      spec: {
        purpose: 'shot.first-frame',
        target: takeTarget,
      } as never,
      materializationState: 'generatable',
    });
    mockedEstimateDependencyDraft.mockResolvedValue({
      pricing: { state: 'priced', estimatedUsd: 0.25 },
      diagnostics: [],
    });
  });

  it('dedupes structurally identical declarations and merges required lineage', async () => {
    const slot = manualDependencySlot({ required: false });
    const result = await planMediaGenerationDependencyInventory(
      inventoryInput({
        slots: [slot, { ...slot, required: true }],
      })
    );

    expect(result.dependencyInventory.dependencies).toHaveLength(1);
    expect(result.dependencyInventory.dependencies[0]).toMatchObject({
      dependencyId: 'manual:test',
      required: true,
      requiredBy: ['root:shot.video-take'],
    });
  });

  it('rejects duplicate declarations with conflicting selector contracts', async () => {
    const slot = manualDependencySlot({ required: true });

    await expect(
      planMediaGenerationDependencyInventory(
        inventoryInput({
          slots: [
            slot,
            {
              ...slot,
              selector: {
                kind: 'manual-attachment',
                target: { kind: 'location', id: 'location-a' },
              },
            },
          ],
        })
      )
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_CONFLICTING_DECLARATION',
    });
  });

  it('blocks root creation when a required manual dependency is missing', async () => {
    const result = await planMediaGenerationDependencyInventory(
      inventoryInput({
        slots: [manualDependencySlot({ required: true })],
      })
    );

    expect(result.dependencyInventory.rootGeneration).toMatchObject({
      canCreateSpec: false,
      blockedReason: expect.stringContaining('required dependencies'),
    });
    expect(result.dependencyInventory.diagnostics).toEqual([
      expect.objectContaining({
        code: 'CORE_MEDIA_DEPENDENCY_REQUIRED_ATTACHMENT',
        severity: 'error',
      }),
    ]);
    expect(result.dependencyInventory.agentChecklist[0]).toMatchObject({
      action: 'import-or-select-asset',
      dependencyLineId: 'dependency:manual:test',
    });
  });

  it('keeps optional invalid selections local to the dependency line', async () => {
    const result = await planMediaGenerationDependencyInventory(
      inventoryInput({
        slots: [manualDependencySlot({ required: false })],
        resolveSelection: async () => ({
          state: 'invalid-selection',
          asset: null,
          diagnostics: [
            createDiagnosticError(
              'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
              'Selected asset has no file.',
              { path: ['dependencyInventory'] },
              'Import the file.'
            ),
          ],
        }),
      })
    );

    expect(result.dependencyInventory.rootGeneration.canCreateSpec).toBe(true);
    expect(result.dependencyInventory.diagnostics).toEqual([]);
    expect(result.dependencyInventory.dependencies[0]).toMatchObject({
      availability: { state: 'invalid-selection' },
      generationDraft: {
        state: 'blocked',
        reason: expect.stringContaining('Resolve the selected asset'),
      },
    });
  });

  it('plans generated dependencies and expands their child dependency declarations', async () => {
    const child = manualDependencySlot({
      dependencyId: 'manual:child',
      required: true,
    });
    const result = await planMediaGenerationDependencyInventory(
      inventoryInput({
        slots: [generatedDependencySlot('first-frame:take:take-a')],
        declareDependencies: async ({ lineId }) =>
          lineId === 'dependency:first-frame:take:take-a' ? [child] : [],
      })
    );

    expect(mockedPlanDependencyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'shot.first-frame',
      })
    );
    expect(result.dependencyInventory.dependencies.map((line) => line.id))
      .toEqual([
        'dependency:first-frame:take:take-a',
        'dependency:manual:child',
      ]);
  });

  it('honors regenerate policy by ignoring a selected asset', async () => {
    const result = await planMediaGenerationDependencyInventory(
      inventoryInput({
        slots: [generatedDependencySlot('first-frame:take:take-a')],
        inputPolicyMode: () => 'regenerate',
        resolveSelection: async () => ({
          state: 'satisfied',
          asset: {
            assetId: 'asset-a',
            assetFileId: 'file-a',
            projectRelativePath: 'generated/frame.png' as never,
          },
          diagnostics: [],
        }),
      })
    );

    expect(result.dependencyInventory.dependencies[0]).toMatchObject({
      availability: { state: 'missing-generated' },
      selectedAsset: null,
      pricing: { state: 'priced', estimatedUsd: 0.25 },
    });
  });

  it('rejects recursive dependency cycles with a structured diagnostic', async () => {
    const slot = generatedDependencySlot('first-frame:take:take-a');

    await expect(
      planMediaGenerationDependencyInventory(
        inventoryInput({
          slots: [slot],
          declareDependencies: async () => [slot],
        })
      )
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED',
    });
  });

  it('rejects dependency expansion past the maximum depth', async () => {
    const slots = Array.from({ length: 10 }, (_, index) =>
      generatedDependencySlot(`first-frame:take:take-${index}`)
    );

    await expect(
      planMediaGenerationDependencyInventory(
        inventoryInput({
          slots: [slots[0]!],
          declareDependencies: async ({ slot }) => {
            const currentIndex = slots.findIndex(
              (candidate) => candidate.dependencyId === slot.dependencyId
            );
            return currentIndex >= 0 && currentIndex < slots.length - 1
              ? [slots[currentIndex + 1]!]
              : [];
          },
        })
      )
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_MAX_DEPTH_EXCEEDED',
    });
  });
});

function inventoryInput(overrides: {
  slots?: MediaGenerationDependencySlot[];
  resolveSelection?: Parameters<typeof planMediaGenerationDependencyInventory>[0]['resolveSelection'];
  declareDependencies?: Parameters<typeof planMediaGenerationDependencyInventory>[0]['declareDependencies'];
  inputPolicyMode?: Parameters<typeof planMediaGenerationDependencyInventory>[0]['inputPolicyMode'];
} = {}): Parameters<typeof planMediaGenerationDependencyInventory>[0] {
  return {
    rootPurpose: 'shot.video-take',
    rootTarget: takeTarget,
    rootLineId: 'root:shot.video-take',
    rootLabel: 'Shot video take',
    rootMediaKind: 'video',
    request: { kind: 'test' },
    slots: overrides.slots ?? [],
    diagnostics: [],
    resolveSelection:
      overrides.resolveSelection ??
      (async () => ({ state: 'missing', asset: null, diagnostics: [] })),
    declareDependencies: overrides.declareDependencies ?? (async () => []),
    estimateRoot: async () => ({
      pricing: { state: 'priced', estimatedUsd: 1 },
      diagnostics: [],
      estimate: null,
    }),
    ...(overrides.inputPolicyMode
      ? { inputPolicyMode: overrides.inputPolicyMode }
      : {}),
  };
}

function manualDependencySlot(input: {
  dependencyId?: string;
  required: boolean;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: input.dependencyId ?? 'manual:test',
    dependencyKind: 'manual-attachment',
    label: 'Manual plate',
    dependencyTarget: { kind: 'scene', id: 'scene-a' },
    selector: {
      kind: 'manual-attachment',
      target: { kind: 'scene', id: 'scene-a' },
    },
    required: input.required,
    reason: 'Manual attachment required.',
  };
}

function generatedDependencySlot(
  dependencyId: string
): MediaGenerationDependencySlot {
  return {
    dependencyId,
    dependencyKind: 'first-frame',
    label: 'First frame',
    dependencyTarget: takeTarget,
    selector: {
      kind: 'shot-video-input',
      inputKind: 'first-frame',
      takeId: takeTarget.takeId,
      shotIds: takeTarget.shotIds,
    },
    required: true,
    reason: 'Route requires a first frame.',
  };
}
