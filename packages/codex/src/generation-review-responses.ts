import { createProjectDataService, createStudioOperationId, notifyStudioProjectResourcesChanged } from '@gorenku/studio-core/server';
import type { GenerationReviewResponse } from './client.js';
import { GenerationReviewState } from './generation-review-state.js';
import { assertReviewSources } from './generation-review-sources.js';

export async function respondToGenerationReview(state: GenerationReviewState, response: GenerationReviewResponse, homeDir?: string) {
  const repeated = state.repeatedResponse(response);
  if (repeated) return { action: actionReceipt(repeated), review: state.read(response.reviewId) };
  state.assertRevision(response.reviewId, response.expectedRevision);
  if (response.action !== 'cancel') await assertReviewSources(state.binding(response.reviewId), homeDir);
  const action = state.respond(response);
  if (response.action === 'submit' && response.askBeforeGeneratingNextTime !== undefined) {
    await applyAskBeforeGenerating(state.binding(response.reviewId), response.askBeforeGeneratingNextTime, homeDir);
  }
  return { action: actionReceipt(action), review: state.read(response.reviewId) };
}

/** The review owns only the lane's "Ask Before Generating" field, changed through Core's focused lane command. */
async function applyAskBeforeGenerating(binding: ReturnType<GenerationReviewState['binding']>, askBeforeGenerating: boolean, homeDir?: string): Promise<void> {
  const projectData = createProjectDataService();
  const projectRef = await projectData.resolveStudioProjectRef({ projectName: binding.project, homeDir });
  const report = await projectData.updateGenerationLaneSettings({ projectName: binding.project, homeDir, lane: binding.lane, askBeforeGenerating });
  await notifyStudioProjectResourcesChanged({
    homeDir,
    notification: {
      projectRef,
      resourceKeys: report.resourceKeys,
      source: { kind: 'cli', command: 'renku studio mcp generation.review.respond' },
      operationId: createStudioOperationId(),
    },
  });
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
