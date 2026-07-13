import {
  describeGenerationModelInputs,
  estimateGenerationProviderRequest,
  hashGenerationCostApproval,
  type GenerationMediaKind,
  type GenerationModelInputDescriptor,
} from '@gorenku/studio-engines';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  GenerationCostEstimateReport,
  GenerationEstimateReport,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { GenerationPurposeContract } from './purpose-contract.js';

export interface GenerationCostEstimateInput {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  values: Record<string, JsonValue>;
  inputMediaCounts: Partial<Record<'image' | 'audio' | 'video', number>>;
}

export async function estimateGenerationCost(
  input: GenerationCostEstimateInput
): Promise<GenerationCostEstimateReport> {
  const cost = await estimateGenerationProviderRequest({
    provider: input.provider,
    model: input.model,
    mediaKind: input.mediaKind,
    payload: input.values,
    inputMediaCounts: input.inputMediaCounts,
  });
  if (cost.state !== 'priced') {
    return {
      valid: false,
      diagnostics: [createDiagnosticError(
        'CORE_GENERATION_PRICE_UNAVAILABLE',
        cost.state === 'missing-pricing-input'
          ? `Generation price requires: ${cost.missingInputs.join(', ')}.`
          : cost.reason,
        { path: ['values'] },
        'Provide every value required for an exact price.'
      )],
    };
  }
  return {
    valid: true,
    estimate: {
      provider: input.provider,
      model: input.model,
      estimatedCostUsd: cost.estimatedCostUsd,
      billableUnits: cost.billableUnits as Record<string, JsonValue>,
    },
    diagnostics: [],
  };
}

export async function estimateGeneration(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
}): Promise<GenerationEstimateReport> {
  const provider = input.spec.model?.provider?.trim();
  const model = input.spec.model?.model?.trim();
  if (!provider || !model) {
    return {
      valid: false,
      diagnostics: [createDiagnosticError(
        'CORE_GENERATION_MODEL_INVALID',
        'Generation provider and model are required for a cost estimate.',
        { path: ['model'] },
        'Choose an actual provider endpoint.'
      )],
    };
  }
  const descriptor = await describeGenerationModelInputs({ provider, model });
  const estimate = await estimateGenerationCost({
    provider,
    model,
    mediaKind: input.purpose.outputMediaKind,
    values: input.spec.values,
    inputMediaCounts: generationSpecInputMediaCounts(input.spec, descriptor),
  });
  if (!estimate.valid) {
    return estimate;
  }
  return {
    valid: true,
    estimate: {
      ...estimate.estimate,
      approvalToken: hashGenerationCostApproval({
        provider,
        model,
        estimatedCostUsd: estimate.estimate.estimatedCostUsd,
      }),
    },
    diagnostics: [],
  };
}

function generationSpecInputMediaCounts(
  spec: GenerationSpec,
  descriptor: GenerationModelInputDescriptor | null
) {
  const counts = requiredInputMediaCounts(descriptor);
  if (!descriptor) {
    return counts;
  }
  const selectedCounts = { image: 0, audio: 0, video: 0 };
  for (const selection of spec.references) {
    if (!selection.included || !selection.providerField) {
      continue;
    }
    const field = descriptor.fields.find(
      (candidate) => candidate.name === selection.providerField
    );
    if (field?.semantic?.kind !== 'media') {
      continue;
    }
    selectedCounts[mediaKindForRole(field.semantic.role)] += 1;
  }
  counts.image = Math.max(counts.image, selectedCounts.image);
  counts.audio = Math.max(counts.audio, selectedCounts.audio);
  counts.video = Math.max(counts.video, selectedCounts.video);
  return counts;
}

export function requiredInputMediaCounts(
  descriptor: GenerationModelInputDescriptor | null
) {
  const counts = { image: 0, audio: 0, video: 0 };
  for (const field of descriptor?.fields ?? []) {
    if (!field.media || field.media.minimum <= 0) {
      continue;
    }
    const mediaKind = field.media.acceptedKinds[0];
    if (mediaKind) {
      counts[mediaKind] += field.media.minimum;
    }
  }
  return counts;
}

function mediaKindForRole(
  role: Extract<
    NonNullable<GenerationModelInputDescriptor['fields'][number]['semantic']>,
    { kind: 'media' }
  >['role']
): 'image' | 'audio' | 'video' {
  if (role === 'audio') {
    return 'audio';
  }
  if (role === 'source-video') {
    return 'video';
  }
  return 'image';
}
