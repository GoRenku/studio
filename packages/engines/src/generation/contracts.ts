import type { ModelPriceConfig, ModelType } from '../model-catalog.js';

export type GenerationMediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type GenerationMode =
  | 'text-to-image'
  | 'reference-to-image'
  | 'image-edit'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-audio'
  | 'text-to-speech'
  | 'text'
  | 'json';

export interface GenerationModelSummary {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  modes: GenerationMode[];
  mime: string[];
  price?: ModelPriceConfig | number;
}

export interface GenerationPolicy {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  mode?: GenerationMode;
  parameters?: Record<string, unknown>;
  outputCount?: number;
}

export interface GenerationInputFile {
  name: string;
  projectRelativePath: string;
  mediaKind: GenerationMediaKind;
}

export interface GenerationRequest {
  prompt?: string;
  inputFiles?: GenerationInputFile[];
  parameters?: Record<string, unknown>;
  outputNames?: string[];
}

export interface GenerationEstimate {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  pricing: ModelPriceConfig | number | null;
  estimatedCostUsd: number | null;
  approvalToken: string;
  billableUnits: Record<string, unknown>;
  warnings: string[];
}

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
  mode?: GenerationMode;
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
