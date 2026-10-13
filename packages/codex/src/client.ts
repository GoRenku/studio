import type { GenerationLane, GenerationRouteBilling, JsonValue, MediaGenerationPreviewResource, MediaGenerationReferenceView } from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { NativeRequestControls } from './native-request-controls/contracts.js';

export interface GenerationReviewCapabilities {
  client: { name: string; version: string; title?: string } | null;
  panel: {
    status: 'advertised' | 'unavailable';
    reason: 'codex-ui-advertised' | 'non-codex-client' | 'mcp-app-ui-unavailable';
  };
}

export interface GenerationReviewRoute {
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
  mediaKind: 'image' | 'video' | 'audio';
  /** From the Skill's Route Description; host plan usage is never sent to the estimator. */
  billing: GenerationRouteBilling;
}

export type GenerationReviewReference = Omit<MediaGenerationReferenceView, 'projectRelativePath' | 'browserUrl'> & {
  referenceId: string;
  resourceUri: string;
  thumbnailUri?: string;
};

export interface GenerationReviewRequest {
  requestId: string;
  requestSha256: string;
  /** `preview.estimate` is the server-computed estimate of the prepared request. */
  preview: Omit<MediaGenerationPreviewResource, 'documentPath' | 'references'> & { references: GenerationReviewReference[] };
  routes: GenerationReviewRoute[];
  controls: NativeRequestControls;
}

export interface GenerationReviewDraft {
  requestId: string;
  prompt: string | null;
  values: Record<string, JsonValue>;
}

export interface GenerationReview {
  reviewId: string;
  revision: number;
  lane: GenerationLane;
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
  /** Applied to the lane's "Ask Before Generating" only with a submit action. */
  askBeforeGeneratingNextTime?: boolean;
}

export interface GenerationReviewEstimateInput {
  reviewId: string;
  requestId: string;
  values: Record<string, JsonValue>;
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
