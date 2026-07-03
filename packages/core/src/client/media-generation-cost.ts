import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type { MediaGenerationPurpose } from './media-generation-purpose.js';
import type { MediaGenerationTarget } from './media-generation-target.js';

export type MediaGenerationCostLineSource =
  | { kind: 'root-generation' }
  | { kind: 'generated-dependency'; dependencyId: string }
  | { kind: 'selected-existing-asset'; dependencyId: string };

export interface GenerationCostLine {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget | null;
  label: string;
  source: MediaGenerationCostLineSource;
  estimate: GenerationCostEstimate;
}

export interface MediaGenerationCostTotal {
  state: 'complete' | 'partial' | 'missing-pricing-input';
  estimatedTotalUsd: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  missingPricingInputLineCount: number;
  requiresPriceOverride: boolean;
}

export interface MediaGenerationCostPlan {
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  lines: GenerationCostLine[];
  total: MediaGenerationCostTotal;
  diagnostics: DiagnosticIssue[];
}

export interface MediaGenerationCostProjection {
  priceKey: import('@gorenku/studio-engines').GenerationPriceKey;
  pricingInputs: import('@gorenku/studio-engines').GenerationPricingInputs;
  estimate: GenerationCostEstimate;
}
