import type { GenerationCostEstimate, JsonValue } from '@gorenku/studio-core/client';
import { readMediaGenerationReview } from '@gorenku/studio-core/server';
import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewEstimateInput } from './client.js';
import { reviewError } from './diagnostics.js';
import { preparedRoute, type GenerationReviewState } from './generation-review-state.js';
import { assertReviewSources } from './generation-review-sources.js';
import { removeJsonPointer, writeJsonPointer } from './native-request-controls/json-pointer.js';
import { nativeRequestControlList, nativeRequestValuesIssues } from './native-request-controls/validation.js';

/**
 * Estimates one native request. The CLI composition root injects the Engines
 * implementation; Codex never imports Engines and never reads prices.
 */
export interface GenerationCostEstimator {
  estimate(input: {
    homeDir?: string;
    provider: string;
    model: string;
    request: JsonValue;
    requestSha256: string;
  }): Promise<GenerationCostEstimate>;
}

/** Routes the Skill marks as host plan usage are never sent to the estimator. */
export function hostPlanUsageEstimate(requestSha256: string): GenerationCostEstimate {
  return {
    state: 'hostPlanUsage',
    amountUsd: null,
    basis: 'Uses your ChatGPT plan\'s Codex usage',
    observedAt: null,
    sourceUrl: null,
    notes: [],
    requestSha256,
  };
}

/** Re-estimates one review request with the panel's edited native control values. */
export async function estimateReviewDraft(
  state: GenerationReviewState,
  input: GenerationReviewEstimateInput,
  estimator: GenerationCostEstimator,
  homeDir?: string,
): Promise<GenerationCostEstimate> {
  const review = state.read(input.reviewId);
  const binding = state.binding(input.reviewId);
  const index = review.requests.findIndex((request) => request.requestId === input.requestId);
  const request = review.requests[index];
  if (!request) throw reviewError('CODEX_REVIEW_INVALID', 'Estimate a request that belongs to this review.');
  const issues = nativeRequestValuesIssues(request.controls, input.values, (path, message) => createDiagnosticError('CODEX_REVIEW_INVALID', message, { path: path.map(String) }), ['values']);
  if (issues.length > 0) throw new StructuredError({ code: 'CODEX_REVIEW_INVALID', message: 'The estimated values are invalid.', issues });
  const source = binding.sources[index]!;
  if (preparedRoute(request).billing === 'hostPlanUsage') return hostPlanUsageEstimate(source.requestSha256);
  await assertReviewSources(binding, homeDir);
  const read = await readMediaGenerationReview({ projectName: binding.project, homeDir, documentPath: source.reviewFile, expectedRequestSha256: source.requestSha256 });
  const omitted = nativeRequestControlList(request.controls)
    .filter((control) => !Object.hasOwn(input.values, control.key))
    .reduce((native, control) => removeJsonPointer(native, control.key), read.document.request);
  const edited = Object.entries(input.values).reduce((native, [pointer, value]) => writeJsonPointer(native, pointer, value), omitted);
  return estimator.estimate({ homeDir, provider: read.document.provider, model: read.document.model, request: edited, requestSha256: source.requestSha256 });
}
