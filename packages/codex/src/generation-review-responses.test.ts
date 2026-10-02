import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewRequest, GenerationReviewResponse } from './client.js';
import { GenerationReviewState } from './generation-review-state.js';
import { consumeGenerationReview, respondToGenerationReview } from './generation-review-responses.js';

const read = vi.hoisted(() => vi.fn());
vi.mock('@gorenku/studio-core/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('@gorenku/studio-core/server')>(),
  readMediaGenerationReview: read,
}));

beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue({ projectRef: { id: 'project-id' }, requestSha256: 'a'.repeat(64) });
});

function fixture() {
  const state = new GenerationReviewState();
  const route = { provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'image-model', label: 'Image model', mediaKind: 'image' as const };
  const request: GenerationReviewRequest = {
    requestId: 'request', requestSha256: 'a'.repeat(64), routes: [route], controls: { groups: [] },
    preview: { kind: 'mediaGenerationPreview', ...route, prompt: 'Café\n@Image1', editable: true, references: [], configuration: {}, diagnostics: [] },
  };
  const review = state.create('review', 'movie', 'project-id', [request], [{ requestId: request.requestId, reviewFile: 'tmp/operations/media-generation/review.json', requestSha256: request.requestSha256, references: new Map() }]);
  const response: GenerationReviewResponse = { reviewId: review.reviewId, expectedRevision: 1, responseId: 'response', action: 'submit', drafts: review.drafts };
  return { state, response };
}

describe('source-bound review actions', () => {
  it('checks the Core-owned hash before storage and consumption and consumes only once', async () => {
    const { state, response } = fixture();
    const accepted = await respondToGenerationReview(state, response);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ projectName: 'movie', expectedRequestSha256: 'a'.repeat(64) }));
    expect(accepted.action).toEqual({ reviewId: 'review', responseId: 'response', revision: 2, action: 'submit' });
    expect(await consumeGenerationReview(state, response)).toEqual({ alreadyConsumed: false, action: state.response('review', 'response').action });
    expect(await consumeGenerationReview(state, response)).toEqual({ alreadyConsumed: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('rejects changed bytes before storage, including invalid replacement JSON', async () => {
    const { state, response } = fixture();
    read.mockRejectedValue(new StructuredError({ code: 'CORE_MEDIA_GENERATION_REVIEW_CHANGED', message: 'The review file changed.' }));
    await expect(respondToGenerationReview(state, response)).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    expect(state.read('review')).toMatchObject({ phase: 'ready', revision: 1 });
  });

  it('leaves an accepted receipt unconsumed when its source or Project changes', async () => {
    const { state, response } = fixture();
    await respondToGenerationReview(state, response);
    read.mockResolvedValue({ projectRef: { id: 'another-project' }, requestSha256: 'a'.repeat(64) });
    await expect(consumeGenerationReview(state, response)).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    expect(state.response('review', 'response').consumed).toBe(false);
  });

  it('rechecks revisions after asynchronous source reads so late responses cannot replace cancellation', async () => {
    const { state, response } = fixture();
    let finishRead!: (value: unknown) => void;
    read.mockReturnValue(new Promise((resolve) => { finishRead = resolve; }));
    const pending = respondToGenerationReview(state, response);
    await respondToGenerationReview(state, { ...response, responseId: 'cancel', action: 'cancel' });
    finishRead({ projectRef: { id: 'project-id' }, requestSha256: 'a'.repeat(64) });
    await expect(pending).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    expect(state.read('review').phase).toBe('cancelled');
  });

  it('allows cancellation without source access but still rejects undeclared draft identities', async () => {
    const { state, response } = fixture();
    read.mockRejectedValue(new Error('Source unavailable'));
    await expect(respondToGenerationReview(state, { ...response, action: 'cancel', drafts: [{ ...response.drafts[0]!, requestId: 'undeclared' }] })).rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
    await respondToGenerationReview(state, { ...response, action: 'cancel' });
    expect(await consumeGenerationReview(state, response)).toEqual({ alreadyConsumed: false, action: state.response('review', 'response').action });
    expect(read).not.toHaveBeenCalled();
  });
});
