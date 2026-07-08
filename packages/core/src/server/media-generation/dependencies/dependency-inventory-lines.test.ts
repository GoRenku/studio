import { describe, expect, it } from 'vitest';
import type {
  MediaGenerationDependencyInventory,
  MediaGenerationDependencyLine,
  MediaGenerationRootGenerationLine,
} from '../../../client/index.js';
import {
  aggregateDependencyInventoryEstimate,
  planLinesFromDependencyInventory,
} from './dependency-inventory-lines.js';

describe('media generation dependency inventory lines', () => {
  it('aggregates complete, partial, and unavailable estimate states', () => {
    expect(
      aggregateDependencyInventoryEstimate({
        dependencies: [
          dependencyLine({
            id: 'dependency:first-frame',
            pricing: { state: 'priced', estimatedUsd: 0.2 },
          }),
        ],
        rootGeneration: rootLine({
          pricing: { state: 'priced', estimatedUsd: 1.2 },
        }),
      })
    ).toEqual({
      state: 'complete',
      estimatedTotalUsd: 1.4,
      pricedDependencyCount: 2,
      unpricedDependencyCount: 0,
      unavailableDependencyCount: 0,
      requiresPriceOverride: false,
    });

    expect(
      aggregateDependencyInventoryEstimate({
        dependencies: [
          dependencyLine({
            id: 'dependency:first-frame',
            pricing: {
              state: 'unpriced',
              estimatedUsd: null,
              reason: 'No price.',
              overrideRequired: true,
            },
          }),
        ],
        rootGeneration: rootLine({
          pricing: { state: 'priced', estimatedUsd: 1.2 },
        }),
      })
    ).toMatchObject({
      state: 'partial',
      estimatedTotalUsd: 1.2,
      unpricedDependencyCount: 1,
      requiresPriceOverride: true,
    });

    expect(
      aggregateDependencyInventoryEstimate({
        dependencies: [
          dependencyLine({
            id: 'dependency:manual',
            required: true,
            availability: { state: 'missing-manual' },
            pricing: { state: 'not-applicable', estimatedUsd: null },
          }),
        ],
        rootGeneration: rootLine({
          pricing: {
            state: 'missing-pricing-input',
            estimatedUsd: null,
            missingInputs: ['durationSeconds'],
          },
        }),
      })
    ).toMatchObject({
      state: 'unavailable',
      estimatedTotalUsd: null,
      unavailableDependencyCount: 2,
    });
  });

  it('projects dependency and root lines into agent-facing plan lines', () => {
    const lines = planLinesFromDependencyInventory({
      dependencies: [
        dependencyLine({
          id: 'dependency:satisfied',
          label: 'Selected sheet',
          availability: { state: 'satisfied' },
          selectedAsset: {
            assetId: 'asset-a',
            assetFileId: 'file-a',
            projectRelativePath: 'generated/sheet.png' as never,
          },
          generationDraft: { state: 'not-generated' },
        }),
        dependencyLine({
          id: 'dependency:authored',
          dependencyId: 'first-frame:take:take-a',
          dependencyKind: 'first-frame',
          label: 'First frame',
          availability: { state: 'missing-generated' },
          generationDraft: {
            state: 'authored',
            draftGenerationSpec: {
              purpose: 'image.create',
              spec: { purpose: 'image.create' },
            } as never,
          },
        }),
        dependencyLine({
          id: 'dependency:manual',
          dependencyId: 'manual:test',
          dependencyKind: 'manual-attachment',
          label: 'Manual plate',
          availability: { state: 'missing-manual' },
          generationDraft: {
            state: 'blocked',
            reason: 'Attach a plate.',
          },
          pricing: { state: 'not-applicable', estimatedUsd: null },
        }),
      ],
      rootGeneration: rootLine({
        mediaKind: 'video',
        canCreateSpec: false,
        blockedReason: 'Generate dependencies first.',
      }),
    } as MediaGenerationDependencyInventory);

    expect(lines).toEqual([
      expect.objectContaining({
        id: 'line:dependency:satisfied',
        kind: 'reused-asset',
        state: 'ready',
        materializationState: 'materialized',
        sourceAssetId: 'asset-a',
      }),
      expect.objectContaining({
        id: 'line:dependency:authored',
        kind: 'dependency-generation',
        state: 'planned',
        materializationState: 'generatable',
        draftGenerationSpec: {
          purpose: 'image.create',
          spec: { purpose: 'image.create' },
        },
      }),
      expect.objectContaining({
        id: 'line:dependency:manual',
        kind: 'required-attachment',
        state: 'missing',
        materializationState: 'requires-external-input',
        materializationReason: 'Attach a plate.',
      }),
      expect.objectContaining({
        id: 'line:root:shot.video-take',
        kind: 'final-video-generation',
        state: 'planned',
        materializationState: 'blocked-by-dependencies',
        materializationReason: 'Generate dependencies first.',
      }),
    ]);
  });

  it('fails impossible generated dependency lines with a structured error', () => {
    expect(() =>
      planLinesFromDependencyInventory({
        dependencies: [
          dependencyLine({
            id: 'dependency:broken',
            availability: { state: 'missing-generated' },
            generationDraft: { state: 'not-generated' },
          }),
        ],
        rootGeneration: rootLine(),
      } as MediaGenerationDependencyInventory)
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_MEDIA_DEPENDENCY_INVALID_INVENTORY_LINE',
      })
    );
  });
});

function dependencyLine(
  overrides: Partial<MediaGenerationDependencyLine> = {}
): MediaGenerationDependencyLine {
  return {
    id: 'dependency:lookbook-sheet',
    dependencyId: 'lookbook-sheet:lookbook-a',
    dependencyKind: 'lookbook-sheet',
    purpose: 'lookbook.sheet',
    target: { kind: 'lookbook', id: 'lookbook-a' },
    mediaKind: 'image',
    label: 'Lookbook sheet',
    required: true,
    requiredBy: ['root:shot.video-take'],
    diagnostics: [],
    availability: { state: 'missing-generated' },
    pricing: { state: 'priced', estimatedUsd: 0.5 },
    generationDraft: {
      state: 'missing-input',
      reason: 'Author the prompt.',
    },
    selectedAsset: null,
    ...overrides,
  } as MediaGenerationDependencyLine;
}

function rootLine(
  overrides: Partial<MediaGenerationRootGenerationLine> = {}
): MediaGenerationRootGenerationLine {
  return {
    id: 'root:shot.video-take',
    purpose: 'shot.video-take',
    target: {
      kind: 'sceneShotVideoTake',
      id: 'scene-a:take-a',
      sceneId: 'scene-a',
      takeId: 'take-a',
      shotIds: ['shot-a'],
    },
    label: 'Shot video take',
    mediaKind: 'video',
    pricing: { state: 'priced', estimatedUsd: 1 },
    canCreateSpec: true,
    blockedReason: null,
    estimate: null,
    diagnostics: [],
    ...overrides,
  } as MediaGenerationRootGenerationLine;
}
