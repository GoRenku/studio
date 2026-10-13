import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from './project/index.js';
import type { JsonValue } from './json.js';
import type { GenerationCostEstimate } from './generation-cost-estimate.js';

export type MediaGenerationKind = 'image' | 'video' | 'audio';

export interface MediaGenerationReviewDocument {
  provider: string;
  model: string;
  mediaKind: MediaGenerationKind;
  prompt: string | null;
  request: JsonValue;
}

export interface MediaGenerationProvenance extends MediaGenerationReviewDocument {
  receipt?: JsonValue;
}

export interface MediaGenerationReferenceView {
  requestPointer: string;
  kind: MediaGenerationKind;
  projectRelativePath: ProjectRelativePath;
  reviewLabel: string;
  promptMention?: string;
  browserUrl?: string;
  available: boolean;
}

export interface MediaGenerationPreviewResource {
  kind: 'mediaGenerationPreview';
  documentPath?: ProjectRelativePath;
  provider: string;
  model: string;
  mediaKind: MediaGenerationKind;
  prompt: string | null;
  references: MediaGenerationReferenceView[];
  configuration: JsonValue;
  editable: boolean;
  diagnostics: DiagnosticIssue[];
  /** The SHA-256 of the request file this preview shows; null for saved provenance. */
  requestSha256: string | null;
  /** Attached by the caller that estimated the request; null when not estimated. */
  estimate: GenerationCostEstimate | null;
}
