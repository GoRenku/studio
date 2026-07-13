import type { ModelPriceConfig, ModelType } from '../model-catalog.js';

export type GenerationMediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export interface GenerationModelSummary {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  mime: string[];
  price?: ModelPriceConfig | number;
}

export interface GenerationPolicy {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  outputCount?: number;
}

export interface GenerationInputFile {
  field: string;
  payloadPath?: Array<string | number>;
  projectRelativePath: string;
  mediaKind: GenerationMediaKind;
  asArray?: boolean;
  required?: boolean;
}

export interface GenerationRequest {
  inputFiles?: GenerationInputFile[];
  pricingInputCounts?: Partial<Record<GenerationMediaKind, number>>;
  payload: Record<string, unknown>;
  outputNames?: string[];
}

export interface GenerationPriceKey {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
}

export interface GenerationPricingInputs {
  outputCount?: number;
  inputImageCount?: number;
  inputAudioCount?: number;
  inputVideoCount?: number;
  durationSeconds?: number | string;
  characterCount?: number;
  imageSize?: string | { width: number; height: number };
  resolution?: string;
  aspectRatio?: string;
  quality?: string;
  generateAudio?: boolean;
  usesVoiceControl?: boolean;
  numFrames?: number;
  videoSize?: string | { width: number; height: number };
  mode?: string;
  musicLengthMs?: number;
}

export type GenerationCostEstimate =
  | {
      state: 'priced';
      provider: string;
      model: string;
      mediaKind: GenerationMediaKind;
      pricing: ModelPriceConfig | number;
      estimatedCostUsd: number;
      costApprovalToken: string;
      billableUnits: Record<string, unknown>;
      warnings: [];
    }
  | {
      state: 'unpriced';
      provider: string;
      model: string;
      mediaKind: GenerationMediaKind;
      pricing: ModelPriceConfig | number | null;
      estimatedCostUsd: null;
      reason: string;
      costApprovalToken: string | null;
      billableUnits: Record<string, unknown>;
      warnings: string[];
    }
  | {
      state: 'missing-pricing-input';
      provider: string;
      model: string;
      mediaKind: GenerationMediaKind;
      pricing: ModelPriceConfig | number | null;
      estimatedCostUsd: null;
      missingInputs: string[];
      costApprovalToken: null;
      billableUnits: Record<string, unknown>;
      warnings: string[];
    };

export interface GenerationOutput {
  artifactId: string;
  mimeType?: string;
  projectRelativePath?: string;
  contentHash?: string;
  diagnostics?: Record<string, unknown>;
}

export interface GenerationReceipt {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  generatedAt: string;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  requestHash: string;
  outputs: GenerationOutput[];
  simulated: boolean;
}

export interface GenerationRunResult {
  receipt: GenerationReceipt;
  outputs: GenerationOutput[];
  diagnostics?: Record<string, unknown>;
}

export function modelTypeToMediaKind(type: ModelType): GenerationMediaKind | null {
  if (type === 'image' || type === 'audio' || type === 'video' || type === 'json') {
    return type;
  }
  if (type === 'text' || type === 'llm') {
    return 'text';
  }
  return null;
}
