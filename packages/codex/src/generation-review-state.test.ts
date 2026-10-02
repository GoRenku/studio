import { describe, expect, it } from 'vitest';
import type { GenerationReviewRequest, GenerationReviewResponse } from './client.js';
import { GenerationReviewState, type GenerationReviewSource } from './generation-review-state.js';

const route = { provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'image-route', label: 'Image model', mediaKind: 'image' as const };
const alternative = { ...route, model: 'other-image-route', label: 'Other image model' };

function fixture(project = 'movie', reviewId = 'review', requestId = 'request') {
  const state = new GenerationReviewState();
  const request: GenerationReviewRequest = {
    requestId, requestSha256: 'a'.repeat(64), routes: [route, alternative],
    controls: { groups: [{ label: 'Image', fields: [{ key: '/resolution', label: 'Resolution', kind: 'enum', initialValue: '2K', required: true, options: [{ label: '2K', value: '2K' }, { label: '4K', value: '4K', description: 'Larger output' }] }] }] },
    preview: { kind: 'mediaGenerationPreview', ...route, prompt: 'Café\nα and @Image1', editable: true, references: [], configuration: { resolution: '2K' }, diagnostics: [] },
  };
  const source: GenerationReviewSource = { requestId, reviewFile: 'tmp/operations/media-generation/review.json', requestSha256: request.requestSha256, references: new Map() };
  const review = state.create(reviewId, project, `${project}-id`, [request], [source]);
  const response: GenerationReviewResponse = { reviewId, expectedRevision: 1, responseId: 'response', action: 'submit', drafts: review.drafts };
  return { state, review, request, source, response };
}

describe('connection-scoped generation review', () => {
  it('preserves exact multiline and Unicode edits and consumes the accepted response once', () => {
    const { state, response } = fixture();
    response.drafts[0]!.prompt = 'Étude\nα\n@Image1';
    response.drafts[0]!.values['/resolution'] = '4K';
    const action = state.respond(response);
    expect(state.read('review').phase).toBe('submitted');
    expect(action.drafts[0]).toEqual(response.drafts[0]);
    expect(state.consume('review', 'response', 2)).toEqual(action);
    expect(state.consume('review', 'response', 2)).toBeUndefined();
    expect(state.response('review', 'response').consumed).toBe(true);
  });

  it('repeats an identical response idempotently and rejects conflicting reuse', () => {
    const { state, response } = fixture();
    const action = state.respond(response);
    expect(state.respond(structuredClone(response))).toEqual(action);
    expect(state.read('review').revision).toBe(2);
    expect(() => state.respond({ ...response, action: 'cancel' })).toThrow(expect.objectContaining({ code: 'CODEX_REVIEW_STALE' }));
  });

  it('rejects late responses without changing accepted choices', () => {
    const { state, response } = fixture();
    expect(() => state.respond({ ...response, expectedRevision: 2 })).toThrow(expect.objectContaining({ code: 'CODEX_REVIEW_STALE' }));
    expect(state.read('review').phase).toBe('ready');
    expect(state.read('review').revision).toBe(1);
  });

  it('locks reconfiguration until its action is consumed and binds the authorized replacement bytes', () => {
    const { state, response, request, source } = fixture();
    state.respond({ ...response, action: 'reconfigure', selectedRoute: { requestId: request.requestId, route: alternative } });
    const replacement = { ...request, requestSha256: 'b'.repeat(64), preview: { ...request.preview, ...alternative }, controls: { groups: [] } };
    const replacedSource = { ...source, requestSha256: replacement.requestSha256 };
    expect(() => state.update('review', 2, 'movie', 'movie-id', [replacement], [replacedSource])).toThrow();
    expect(state.consume('review', 'response', 2)?.action).toBe('reconfigure');
    const prepared = state.update('review', 2, 'movie', 'movie-id', [replacement], [replacedSource]);
    expect(prepared).toMatchObject({ phase: 'ready', revision: 3, requests: [{ requestSha256: 'b'.repeat(64) }] });
    expect(prepared.drafts[0]!.values).toEqual({});
    expect(prepared.pendingRoute).toBeUndefined();
  });

  it('rejects another model selection while preparation is pending', () => {
    const { state, response, request } = fixture();
    const reconfigure = { ...response, action: 'reconfigure' as const, selectedRoute: { requestId: request.requestId, route: alternative } };
    state.respond(reconfigure);
    expect(() => state.respond({ ...reconfigure, responseId: 'second', expectedRevision: 2 })).toThrow();
    expect(state.read('review').pendingRoute?.route.model).toBe(alternative.model);
  });

  it('retains the previous draft and pending choice when preparation fails', () => {
    const { state, response, request } = fixture();
    state.respond({ ...response, action: 'reconfigure', selectedRoute: { requestId: request.requestId, route: alternative } });
    state.consume('review', 'response', 2);
    const failed = state.preparationFailure('review', 2, [{ code: 'CREDENTIAL_MISSING', message: 'Configure the selected provider.', severity: 'error', location: { path: [] } }]);
    expect(failed.phase).toBe('preparationFailed');
    expect(failed.requests[0]!.preview.model).toBe(route.model);
    expect(failed.pendingRoute?.route.model).toBe(alternative.model);
    expect(failed.drafts).toEqual(response.drafts);
    expect(() => state.respond({ ...response, responseId: 'submit', expectedRevision: 3 })).toThrow();
  });

  it('cancels pending preparation and rejects its superseded action', () => {
    const { state, response, request } = fixture();
    state.respond({ ...response, action: 'reconfigure', selectedRoute: { requestId: request.requestId, route: alternative } });
    state.respond({ ...response, responseId: 'cancel', expectedRevision: 2, action: 'cancel' });
    expect(() => state.consume('review', 'response', 3)).toThrow(expect.objectContaining({ code: 'CODEX_REVIEW_STALE' }));
    expect(state.consume('review', 'cancel', 3)?.action).toBe('cancel');
    expect(state.read('review').phase).toBe('cancelled');
  });

  it('rejects undeclared requests, fields and route identities before accepting a response', () => {
    const { state, response } = fixture();
    expect(() => state.respond({ ...response, drafts: [{ ...response.drafts[0]!, requestId: 'another-request' }] })).toThrow();
    expect(() => state.respond({ ...response, drafts: [{ ...response.drafts[0]!, values: { arbitrary: 'value' } }] })).toThrow();
    expect(() => state.respond({ ...response, action: 'reconfigure', selectedRoute: { requestId: 'request', route: { ...route, model: 'undeclared' } } })).toThrow();
    expect(state.read('review').phase).toBe('ready');
  });

  it('keeps separate reviews and Projects isolated and expires them with the connection', () => {
    const { state, request, source } = fixture();
    state.create('other-review', 'other-movie', 'other-id', [{ ...request, requestId: 'other-request' }], [{ ...source, requestId: 'other-request' }]);
    expect(state.binding('review').project).toBe('movie');
    expect(state.binding('other-review').project).toBe('other-movie');
    const exposed = state.read('review');
    exposed.drafts[0]!.prompt = 'External mutation';
    expect(state.read('review').drafts[0]!.prompt).toBe(request.preview.prompt);
    state.expire();
    expect(() => state.read('review')).toThrow(expect.objectContaining({ code: 'CODEX_REVIEW_EXPIRED' }));
    expect(() => state.read('other-review')).toThrow();
  });

  it('cannot replace another request or Project during preparation', () => {
    const { state, response, request, source } = fixture();
    state.respond({ ...response, action: 'reconfigure', selectedRoute: { requestId: request.requestId, route: alternative } });
    state.consume('review', 'response', 2);
    expect(() => state.update('review', 2, 'other', 'other-id', [request], [source])).toThrow();
    expect(() => state.update('review', 2, 'movie', 'movie-id', [request], [{ ...source, reviewFile: 'tmp/operations/media-generation/another.json' }])).toThrow();
  });
});
