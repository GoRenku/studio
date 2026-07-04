import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MediaGenerationDependencyPricing,
  MediaGenerationPurpose,
} from '../../../client/index.js';

vi.mock('../lifecycle/purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

import {
  requireMediaGenerationPurposeDefinition,
} from '../lifecycle/purpose-lifecycle-registry.js';
import {
  planMediaGenerationDependencyDraft,
  type MediaGenerationDependencyDraftSpecInput,
} from './dependency-draft-specs.js';

const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);

describe('media generation dependency draft specs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generatable dependency drafts from the owning purpose', async () => {
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.sheet',
      planDependencyDraft: vi.fn(async () => ({
        purpose: 'lookbook.sheet',
        spec: { purpose: 'lookbook.sheet', prompt: 'Style sheet' },
        materializationState: 'generatable',
      })),
    } as never);

    await expect(
      planMediaGenerationDependencyDraft({
        purpose: 'lookbook.sheet',
        draftInput: draftInput(),
      })
    ).resolves.toEqual({
      purpose: 'lookbook.sheet',
      spec: { purpose: 'lookbook.sheet', prompt: 'Style sheet' },
      materializationState: 'generatable',
    });
  });

  it('returns missing-input dependency drafts with pricing and diagnostics', async () => {
    const pricing: MediaGenerationDependencyPricing = {
      state: 'missing-pricing-input',
      estimatedUsd: null,
      missingInputs: ['prompt'],
    };
    const diagnostic = createDiagnosticError(
      'CORE_MEDIA_DEPENDENCY_PROMPT_MISSING',
      'Prompt is missing.',
      { path: ['prompt'] },
      'Author the prompt.'
    );
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.sheet',
      planDependencyDraft: vi.fn(async () => ({
        materializationState: 'missing-input',
        materializationReason: 'Author the prompt.',
        pricing,
        estimate: null,
        diagnostics: [diagnostic],
      })),
    } as never);

    await expect(
      planMediaGenerationDependencyDraft({
        purpose: 'lookbook.sheet',
        draftInput: draftInput(),
      })
    ).resolves.toEqual({
      materializationState: 'missing-input',
      materializationReason: 'Author the prompt.',
      pricing,
      estimate: null,
      diagnostics: [diagnostic],
    });
  });

  it('fails purposes without dependency draft builders', async () => {
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.sheet',
    } as never);

    await expect(
      planMediaGenerationDependencyDraft({
        purpose: 'lookbook.sheet',
        draftInput: draftInput(),
      })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_MISSING_DRAFT_BUILDER',
    });
  });

  it('fails dependency draft builders that omit materialization state', async () => {
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.sheet',
      planDependencyDraft: vi.fn(async () => ({
        purpose: 'lookbook.sheet',
        spec: { purpose: 'lookbook.sheet' },
      })),
    } as never);

    await expect(
      planMediaGenerationDependencyDraft({
        purpose: 'lookbook.sheet',
        draftInput: draftInput(),
      })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_DEPENDENCY_DRAFT_MATERIALIZATION_STATE_MISSING',
    });
  });
});

function draftInput(): MediaGenerationDependencyDraftSpecInput {
  return {
    rootPurpose: 'shot.video-take' as MediaGenerationPurpose,
    rootTarget: {
      kind: 'sceneShotVideoTake',
      id: 'scene-a:take-a',
      sceneId: 'scene-a',
      takeId: 'take-a',
      shotIds: ['shot-a'],
    },
    request: { kind: 'test' },
    dependencyKind: 'lookbook-sheet',
    dependencyTarget: { kind: 'lookbook', id: 'lookbook-a' },
    label: 'Lookbook sheet',
    reason: 'Style reference.',
  };
}
