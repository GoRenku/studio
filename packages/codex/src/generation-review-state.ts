import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationReview, GenerationReviewAction, GenerationReviewRequest, GenerationReviewResponse } from './client.js';
import { initialReviewDraft, validateReviewDraftIdentities, validateReviewDrafts } from './generation-review-contracts.js';
import { reviewError } from './diagnostics.js';

export interface GenerationReviewSource {
  requestId: string;
  reviewFile: string;
  requestSha256: string;
  references: Map<string, string>;
}

interface ReviewSession {
  project: string;
  projectId: string;
  review: GenerationReview;
  sources: GenerationReviewSource[];
  responses: Map<string, { fingerprint: string; action: GenerationReviewAction; consumed: boolean }>;
  pendingResponseId?: string;
}

export class GenerationReviewState {
  private readonly sessions = new Map<string, ReviewSession>();

  create(reviewId: string, project: string, projectId: string, requests: GenerationReviewRequest[], sources: GenerationReviewSource[]): GenerationReview {
    const review: GenerationReview = {
      reviewId, revision: 1, phase: 'ready', requests,
      drafts: requests.map(initialReviewDraft), diagnostics: [],
    };
    this.sessions.set(review.reviewId, { project, projectId, review, sources, responses: new Map() });
    return structuredClone(review);
  }

  read(reviewId: string): GenerationReview {
    return structuredClone(this.session(reviewId).review);
  }

  binding(reviewId: string): { project: string; projectId: string; sources: GenerationReviewSource[] } {
    const session = this.session(reviewId);
    return { project: session.project, projectId: session.projectId, sources: structuredClone(session.sources) };
  }

  assertRevision(reviewId: string, expectedRevision: number): void {
    if (this.session(reviewId).review.revision !== expectedRevision) {
      throw reviewError('CODEX_REVIEW_STALE', 'The review changed. Refresh the panel before responding.');
    }
  }

  update(reviewId: string, expectedRevision: number, project: string, projectId: string, requests: GenerationReviewRequest[], sources: GenerationReviewSource[]): GenerationReview {
    this.assertRevision(reviewId, expectedRevision);
    const session = this.session(reviewId);
    this.assertUpdate(session, project, projectId, requests, sources);
    const pending = session.review.pendingRoute;
    session.review.requests = requests;
    session.review.drafts = requests.map((request) => (
      pending?.requestId === request.requestId
        ? initialReviewDraft(request)
        : session.review.drafts.find((draft) => draft.requestId === request.requestId)!
    ));
    session.sources = sources;
    session.review.phase = 'ready';
    session.review.revision += 1;
    session.review.diagnostics = [];
    delete session.review.pendingRoute;
    delete session.pendingResponseId;
    return structuredClone(session.review);
  }

  preparationFailure(reviewId: string, expectedRevision: number, diagnostics: DiagnosticIssue[]): GenerationReview {
    this.assertRevision(reviewId, expectedRevision);
    const session = this.session(reviewId);
    if (session.review.phase !== 'preparing') throw reviewError('CODEX_REVIEW_INVALID', 'No model preparation is pending.');
    if (!session.pendingResponseId || !session.responses.get(session.pendingResponseId)?.consumed) throw reviewError('CODEX_REVIEW_INVALID', 'Consume the pending reconfiguration before reporting its preparation result.');
    session.review.phase = 'preparationFailed';
    session.review.diagnostics = structuredClone(diagnostics);
    session.review.revision += 1;
    return structuredClone(session.review);
  }

  repeatedResponse(response: GenerationReviewResponse): GenerationReviewAction | undefined {
    const previous = this.session(response.reviewId).responses.get(response.responseId);
    if (!previous) return undefined;
    if (previous.fingerprint !== fingerprint(response)) throw reviewError('CODEX_REVIEW_STALE', 'This response identity was already used for different choices.');
    return structuredClone(previous.action);
  }

  respond(response: GenerationReviewResponse): GenerationReviewAction {
    const previous = this.repeatedResponse(response);
    if (previous) return previous;
    this.assertRevision(response.reviewId, response.expectedRevision);
    const session = this.session(response.reviewId);
    this.assertResponse(session, response);
    if (response.action === 'cancel') validateReviewDraftIdentities(session.review.requests, response.drafts);
    else validateReviewDrafts(session.review.requests, response.drafts);
    session.review.drafts = structuredClone(response.drafts);
    session.review.revision += 1;
    session.review.phase = responsePhases[response.action];
    if (response.selectedRoute) session.review.pendingRoute = structuredClone(response.selectedRoute);
    const action: GenerationReviewAction = {
      reviewId: response.reviewId, responseId: response.responseId, revision: session.review.revision,
      action: response.action, drafts: structuredClone(response.drafts),
      ...(response.selectedRoute ? { selectedRoute: structuredClone(response.selectedRoute) } : {}),
      requests: session.sources.map((source, index) => ({
        requestId: source.requestId, reviewFile: source.reviewFile, requestSha256: source.requestSha256,
        route: preparedRoute(session.review.requests[index]!),
      })),
    };
    session.responses.set(response.responseId, { action, fingerprint: fingerprint(response), consumed: false });
    if (response.action === 'reconfigure') session.pendingResponseId = response.responseId;
    return structuredClone(action);
  }

  response(reviewId: string, responseId: string): { action: GenerationReviewAction; consumed: boolean } {
    const response = this.session(reviewId).responses.get(responseId);
    if (!response) throw reviewError('CODEX_REVIEW_EXPIRED', 'The review action does not exist in this connection.');
    return { action: structuredClone(response.action), consumed: response.consumed };
  }

  consume(reviewId: string, responseId: string, expectedRevision: number): GenerationReviewAction | undefined {
    const session = this.session(reviewId);
    const response = session.responses.get(responseId);
    if (!response) throw reviewError('CODEX_REVIEW_EXPIRED', 'The review action has expired.');
    if (response.consumed) return undefined;
    this.assertRevision(reviewId, expectedRevision);
    if (response.action.revision !== expectedRevision) throw reviewError('CODEX_REVIEW_STALE', 'This action was superseded by another panel response.');
    response.consumed = true;
    return structuredClone(response.action);
  }

  expire(): void {
    this.sessions.clear();
  }

  private session(reviewId: string): ReviewSession {
    const session = this.sessions.get(reviewId);
    if (!session) throw reviewError('CODEX_REVIEW_EXPIRED', 'This review has expired. Open a fresh review before generation.');
    return session;
  }

  private assertUpdate(session: ReviewSession, project: string, projectId: string, requests: GenerationReviewRequest[], sources: GenerationReviewSource[]): void {
    if (session.project !== project || session.projectId !== projectId) throw reviewError('CODEX_REVIEW_INVALID', 'A review cannot change its Project.');
    if (session.review.phase !== 'preparing') throw reviewError('CODEX_REVIEW_INVALID', 'A prepared replacement requires a pending reconfiguration.');
    if (!session.pendingResponseId || !session.responses.get(session.pendingResponseId)?.consumed) throw reviewError('CODEX_REVIEW_INVALID', 'Consume the pending reconfiguration before replacing its request.');
    if (sources.length !== session.sources.length) throw reviewError('CODEX_REVIEW_INVALID', 'A review cannot change its ordered request set.');
    sources.forEach((source, index) => {
      const bound = session.sources[index]!;
      if (source.requestId !== bound.requestId || source.reviewFile !== bound.reviewFile) throw reviewError('CODEX_REVIEW_INVALID', 'A review cannot become another request.');
      if (source.requestId !== session.review.pendingRoute!.requestId && source.requestSha256 !== bound.requestSha256) throw reviewError('CODEX_REVIEW_STALE', 'An unrelated request changed during model preparation.');
    });
    const selected = session.review.pendingRoute!;
    const replacement = requests.find((request) => request.requestId === selected.requestId);
    if (!replacement || !sameRoute(preparedRoute(replacement), selected.route)) throw reviewError('CODEX_REVIEW_INVALID', 'The prepared replacement does not match the selected route.');
  }

  private assertResponse(session: ReviewSession, response: GenerationReviewResponse): void {
    if (['submitted', 'cancelled'].includes(session.review.phase)) throw reviewError('CODEX_REVIEW_STALE', 'This review is already closed.');
    if (response.action === 'cancel') {
      if (response.selectedRoute) throw reviewError('CODEX_REVIEW_INVALID', 'Cancellation cannot select a route.');
      return;
    }
    if (response.action === 'submit') {
      if (session.review.phase !== 'ready' || response.selectedRoute) throw reviewError('CODEX_REVIEW_INVALID', 'Submit requires a prepared route.');
      return;
    }
    if (!['ready', 'preparationFailed'].includes(session.review.phase)) throw reviewError('CODEX_REVIEW_INVALID', 'Another model preparation is already pending.');
    const selection = response.selectedRoute;
    const request = session.review.requests.find((request) => request.requestId === selection?.requestId);
    if (!selection || !request?.routes.some((route) => sameRoute(route, selection.route))) throw reviewError('CODEX_REVIEW_INVALID', 'Select a declared exact route.');
  }
}

const responsePhases = { reconfigure: 'preparing', submit: 'submitted', cancel: 'cancelled' } as const;

export function sameRoute(left: Pick<GenerationReviewRequest['routes'][number], 'provider' | 'model' | 'mediaKind'>, right: Pick<GenerationReviewRequest['routes'][number], 'provider' | 'model' | 'mediaKind'>): boolean {
  return left.provider === right.provider && left.model === right.model && left.mediaKind === right.mediaKind;
}

export function preparedRoute(request: GenerationReviewRequest): GenerationReviewRequest['routes'][number] {
  const route = request.routes.find((route) => sameRoute(route, request.preview));
  if (!route) throw reviewError('CODEX_REVIEW_INVALID', 'The prepared route is missing from the declared choices.');
  return route;
}

function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${fingerprint(entry)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
