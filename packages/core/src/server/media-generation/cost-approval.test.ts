import { describe, expect, it } from 'vitest';
import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import { LOCATION_HERO_GENERATION_PURPOSE } from '../../client/index.js';
import {
  parseMediaGenerationRunCostApproval,
  requireMediaGenerationCostApproval,
} from './cost-approval.js';

describe('media generation cost approval', () => {
  it('does not require approval for simulated generation', () => {
    expect(
      requireMediaGenerationCostApproval({
        mode: 'simulated',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: missingPricingInputEstimate(),
        approval: { kind: 'none' },
      })
    ).toEqual({ kind: 'simulated' });
  });

  it('rejects live priced generation without approval', () => {
    expectApprovalError(() => {
      requireMediaGenerationCostApproval({
        mode: 'live',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: pricedEstimate(),
        approval: { kind: 'none' },
      });
    }, 'CORE_MEDIA_COST_APPROVAL_REQUIRED');
  });

  it('rejects stale live priced approval tokens', () => {
    expectApprovalError(() => {
      requireMediaGenerationCostApproval({
        mode: 'live',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: pricedEstimate(),
        approval: {
          kind: 'priced',
          approvalToken: 'sha256:stale',
        },
      });
    }, 'CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH');
  });

  it('returns validated current live priced approval', () => {
    const approval = requireMediaGenerationCostApproval({
      mode: 'live',
      purpose: LOCATION_HERO_GENERATION_PURPOSE,
      estimate: pricedEstimate(),
      approval: {
        kind: 'priced',
        approvalToken: 'sha256:current',
      },
    });

    expect(approval).toEqual({
      kind: 'priced',
      approvalToken: 'sha256:current',
    });
  });

  it('rejects live unpriced generation without explicit unpriced approval', () => {
    expectApprovalError(() => {
      requireMediaGenerationCostApproval({
        mode: 'live',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: unpricedEstimate(),
        approval: { kind: 'none' },
      });
    }, 'CORE_MEDIA_COST_UNPRICED_APPROVAL_REQUIRED');
  });

  it('accepts live unpriced generation with explicit unpriced approval', () => {
    expect(
      requireMediaGenerationCostApproval({
        mode: 'live',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: unpricedEstimate(),
        approval: { kind: 'unpriced-explicit-approval' },
      })
    ).toEqual({ kind: 'unpriced-explicit-approval' });
  });

  it('rejects live generation with missing pricing inputs before approval', () => {
    expectApprovalError(() => {
      requireMediaGenerationCostApproval({
        mode: 'live',
        purpose: LOCATION_HERO_GENERATION_PURPOSE,
        estimate: missingPricingInputEstimate(),
        approval: { kind: 'unpriced-explicit-approval' },
      });
    }, 'CORE_MEDIA_COST_INPUT_MISSING');
  });

  it('rejects ambiguous priced and unpriced approval intent', () => {
    expectApprovalError(() => {
      parseMediaGenerationRunCostApproval({
        approvalToken: 'sha256:current',
        approveUnpricedCost: true,
      });
    }, 'CORE_MEDIA_COST_APPROVAL_KIND_INVALID');
  });
});

function expectApprovalError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected approval error ${code}.`);
}

function pricedEstimate(): GenerationCostEstimate {
  return {
    state: 'priced',
    provider: 'fal-ai',
    model: 'nano-banana-2/edit',
    mediaKind: 'image',
    pricing: 0.02,
    estimatedCostUsd: 0.02,
    costApprovalToken: 'sha256:current',
    billableUnits: { outputCount: 1 },
    warnings: [],
  };
}

function unpricedEstimate(): GenerationCostEstimate {
  return {
    state: 'unpriced',
    provider: 'fal-ai',
    model: 'experimental-image',
    mediaKind: 'image',
    pricing: null,
    estimatedCostUsd: null,
    reason: 'No pricing is configured for this provider model.',
    costApprovalToken: null,
    billableUnits: { outputCount: 1 },
    warnings: ['No pricing is configured for this provider model.'],
  };
}

function missingPricingInputEstimate(): GenerationCostEstimate {
  return {
    state: 'missing-pricing-input',
    provider: 'fal-ai',
    model: 'duration-video',
    mediaKind: 'video',
    pricing: {
      function: 'costByVideoDurationAndResolution',
      inputs: ['duration', 'resolution'],
    },
    estimatedCostUsd: null,
    missingInputs: ['durationSeconds'],
    costApprovalToken: null,
    billableUnits: { outputCount: 1 },
    warnings: ['Missing pricing input: durationSeconds.'],
  };
}
