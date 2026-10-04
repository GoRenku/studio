import type { GenerationReviewResponse } from './client.js';
import { GenerationReviewState } from './generation-review-state.js';
import { assertReviewSources } from './generation-review-sources.js';

export async function respondToGenerationReview(state: GenerationReviewState, response: GenerationReviewResponse, homeDir?: string) {
  const repeated = state.repeatedResponse(response);
  if (repeated) return { action: actionReceipt(repeated), review: state.read(response.reviewId) };
  state.assertRevision(response.reviewId, response.expectedRevision);
  if (response.action !== 'cancel') await assertReviewSources(state.binding(response.reviewId), homeDir);
  const action = state.respond(response);
  return { action: actionReceipt(action), review: state.read(response.reviewId) };
}

function actionReceipt({ reviewId, responseId, revision, action }: import('./client.js').GenerationReviewAction): import('./client.js').GenerationReviewReceipt {
  return { reviewId, responseId, revision, action };
}

export async function consumeGenerationReview(state: GenerationReviewState, input: { reviewId: string; responseId: string }, homeDir?: string) {
  const receipt = state.response(input.reviewId, input.responseId);
  if (receipt.consumed) return { alreadyConsumed: true as const };
  const revision = state.read(input.reviewId).revision;
  if (receipt.action.action !== 'cancel') await assertReviewSources(state.binding(input.reviewId), homeDir);
  const action = state.consume(input.reviewId, input.responseId, revision);
  if (!action) return { alreadyConsumed: true as const };
  return { alreadyConsumed: false as const, action };
}
