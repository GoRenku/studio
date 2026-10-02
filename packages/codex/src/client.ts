import type { JsonValue, MediaGenerationPreviewResource, MediaGenerationReferenceView } from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface GenerationReviewCapabilities {
  client: { name: string; version: string; title?: string } | null;
  panel: {
    status: 'advertised' | 'unavailable';
    reason: 'codex-ui-advertised' | 'non-codex-client' | 'mcp-app-ui-unavailable';
  };
}

export type GenerationReviewControlKind = 'text' | 'multiline' | 'number' | 'integer' | 'boolean' | 'enum' | 'multi-enum' | 'object' | 'array';

export interface GenerationReviewField {
  /** Root fields use exact native request JSON pointers; object properties use their native property names. */
  key: string;
  label: string;
  description?: string;
  kind: GenerationReviewControlKind;
  initialValue?: JsonValue;
  required?: boolean;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: Array<{ value: JsonValue; label: string; description?: string }>;
  properties?: GenerationReviewField[];
  element?: GenerationReviewField;
}

export interface GenerationReviewControls {
  groups: Array<{ label: string; fields: GenerationReviewField[] }>;
}

export interface GenerationReviewRoute {
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
  mediaKind: 'image' | 'video' | 'audio';
}

export type GenerationReviewReference = Omit<MediaGenerationReferenceView, 'projectRelativePath' | 'browserUrl'> & {
  referenceId: string;
  resourceUri: string;
  thumbnailUri?: string;
};

export interface GenerationReviewRequest {
  requestId: string;
  requestSha256: string;
  preview: Omit<MediaGenerationPreviewResource, 'documentPath' | 'references'> & { references: GenerationReviewReference[] };
  routes: GenerationReviewRoute[];
  controls: GenerationReviewControls;
}

export interface GenerationReviewDraft {
  requestId: string;
  prompt: string | null;
  values: Record<string, JsonValue>;
}

export interface GenerationReview {
  reviewId: string;
  revision: number;
  phase: 'ready' | 'preparing' | 'preparationFailed' | 'submitted' | 'cancelled';
  requests: GenerationReviewRequest[];
  drafts: GenerationReviewDraft[];
  pendingRoute?: { requestId: string; route: GenerationReviewRoute };
  diagnostics: DiagnosticIssue[];
}

export interface GenerationReviewResponse {
  reviewId: string;
  expectedRevision: number;
  responseId: string;
  action: 'reconfigure' | 'submit' | 'cancel';
  drafts: GenerationReviewDraft[];
  selectedRoute?: { requestId: string; route: GenerationReviewRoute };
}

export interface GenerationReviewReceipt {
  reviewId: string;
  responseId: string;
  revision: number;
  action: GenerationReviewResponse['action'];
}

export interface GenerationReviewAction extends GenerationReviewReceipt {
  drafts: GenerationReviewDraft[];
  selectedRoute?: GenerationReviewResponse['selectedRoute'];
  requests: Array<{ requestId: string; reviewFile: string; requestSha256: string; route: GenerationReviewRoute }>;
}
