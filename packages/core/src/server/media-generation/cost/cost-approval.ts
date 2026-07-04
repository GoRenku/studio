import type {
  GenerationCostEstimate,
} from '@gorenku/studio-engines';
import type { MediaGenerationPurpose } from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export type MediaGenerationRunCostApprovalInput =
  | { kind: 'none' }
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };

export type ValidatedMediaGenerationCostApproval =
  | { kind: 'simulated' }
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };

export function parseMediaGenerationRunCostApproval(input: {
  approvalToken?: string;
  approveUnpricedCost?: boolean;
}): MediaGenerationRunCostApprovalInput {
  const approvalToken = input.approvalToken?.trim();
  if (approvalToken && input.approveUnpricedCost) {
    throw invalidApprovalKind({
      message:
        'Media generation received both a priced approval token and explicit unpriced approval.',
      suggestion:
        'Pass either the current cost approval token for a priced estimate or explicit unpriced approval for an unpriced estimate, not both.',
    });
  }
  if (approvalToken) {
    return { kind: 'priced', approvalToken };
  }
  if (input.approveUnpricedCost) {
    return { kind: 'unpriced-explicit-approval' };
  }
  return { kind: 'none' };
}

export function requireMediaGenerationCostApproval(input: {
  mode: 'simulated' | 'live';
  purpose: MediaGenerationPurpose;
  estimate: GenerationCostEstimate;
  approval: MediaGenerationRunCostApprovalInput;
}): ValidatedMediaGenerationCostApproval {
  if (input.mode === 'simulated') {
    return { kind: 'simulated' };
  }

  if (input.estimate.state === 'missing-pricing-input') {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_INPUT_MISSING',
      `Live media generation cannot start for ${input.purpose} because pricing inputs are missing: ${input.estimate.missingInputs.join(', ')}.`,
      {
        suggestion:
          'Fill the missing pricing inputs, estimate again, or use simulation mode if you do not intend live provider spend.',
      }
    );
  }

  if (input.estimate.state === 'unpriced') {
    if (input.approval.kind === 'unpriced-explicit-approval') {
      return { kind: 'unpriced-explicit-approval' };
    }
    if (input.approval.kind === 'priced') {
      throw invalidApprovalKind({
        message:
          `Media generation received priced approval for an unpriced estimate for ${input.purpose}.`,
        suggestion:
          'Explicitly approve unpriced generation, choose a priced model, or use simulation mode.',
      });
    }
    throw new ProjectDataError(
      'CORE_MEDIA_COST_UNPRICED_APPROVAL_REQUIRED',
      `Live media generation requires explicit unpriced cost approval for ${input.purpose}.`,
      {
        suggestion:
          'Pass explicit unpriced approval for this run, choose a priced model, or use simulation mode.',
      }
    );
  }

  if (input.approval.kind === 'unpriced-explicit-approval') {
    throw invalidApprovalKind({
      message:
        `Media generation received unpriced approval for a priced estimate for ${input.purpose}.`,
      suggestion:
        'Estimate again and pass the returned cost approval token for this priced run.',
    });
  }
  if (input.approval.kind === 'none') {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_APPROVAL_REQUIRED',
      `Live media generation requires cost approval for ${input.purpose}.`,
      {
        suggestion:
          'Estimate again and pass the returned cost approval token, or use simulation mode if you do not intend live provider spend.',
      }
    );
  }
  if (input.approval.approvalToken !== input.estimate.costApprovalToken) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH',
      `Live media generation received a stale or mismatched cost approval token for ${input.purpose}.`,
      {
        suggestion:
          'Estimate again and pass the returned cost approval token for this run.',
      }
    );
  }
  return { kind: 'priced', approvalToken: input.approval.approvalToken };
}

export function mediaGenerationRunApprovalToken(
  approval: ValidatedMediaGenerationCostApproval
): string | undefined {
  return approval.kind === 'priced' ? approval.approvalToken : undefined;
}

export function mediaGenerationEstimateWithApproval(
  estimate: GenerationCostEstimate,
  approval: ValidatedMediaGenerationCostApproval
): GenerationCostEstimate & {
  approval: ValidatedMediaGenerationCostApproval;
} {
  return {
    ...estimate,
    approval,
  };
}

function invalidApprovalKind(input: {
  message: string;
  suggestion: string;
}): ProjectDataError {
  return new ProjectDataError(
    'CORE_MEDIA_COST_APPROVAL_KIND_INVALID',
    input.message,
    {
      suggestion: input.suggestion,
    }
  );
}
